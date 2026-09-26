import base64
import sqlite3
import time
import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app import create_app


class FakeCloud:
    def __init__(self): self.records = []
    def user(self, token):
        if token not in ("alice", "bob"): raise HTTPException(401)
        return token
    def record(self, user, purpose):
        self.records.append((user, purpose))
        return "attendance-id"


class FakeFace:
    def embedding(self, image):
        if image.startswith("invalid"): raise ValueError("No hay rostro.")
        return [1.] if image.startswith("alice") else [0.]
    def matches(self, a, b): return a == b


@pytest.fixture
def setup(tmp_path):
    cloud = FakeCloud()
    db = tmp_path / "test.sqlite3"
    client = TestClient(create_app(db, Fernet.generate_key(), FakeFace(), cloud))
    key = ec.generate_private_key(ec.SECP256R1())
    return client, key, cloud, db


def post(client, path, body, user="alice"):
    return client.post(path, json=body, headers={"Authorization": "Bearer " + user})


def challenge(client, purpose="enroll"):
    result = post(client, "/challenge", {"purpose": purpose})
    assert result.status_code == 200, result.text
    return result.json()


def sign(client, key, item):
    public = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return post(client, "/fingerprint", {"id": item["id"], "publicKey": base64.b64encode(public).decode(), "signature": base64.b64encode(key.sign(item["challenge"].encode(), ec.ECDSA(hashes.SHA256()))).decode()})


def face(client, item, name="alice", consent=True, user="alice"):
    return post(client, "/face", {"id": item["id"], "image": name + "x" * 100, "consent": consent}, user)


def enroll(client, key):
    item = challenge(client)
    assert sign(client, key, item).status_code == 200
    assert face(client, item).status_code == 200


def test_order_consent_and_replay(setup):
    client, key, cloud, _ = setup
    item = challenge(client)
    assert face(client, item).status_code == 409
    assert sign(client, key, item).status_code == 200
    assert face(client, item, consent=False).status_code == 400
    assert face(client, item).status_code == 409
    assert not cloud.records


def test_enroll_then_both_factors_and_encryption(setup):
    client, key, cloud, db = setup
    enroll(client, key)
    with sqlite3.connect(db) as conn:
        blob = conn.execute("select template from identities").fetchone()[0]
        assert blob.startswith(b"gAAAA")
    item = challenge(client, "entrada")
    assert sign(client, key, item).status_code == 200
    assert face(client, item).json()["recorded"] is True
    assert face(client, item).status_code == 409
    assert cloud.records == [("alice", "entrada")]


def test_wrong_person_and_wrong_key(setup):
    client, key, cloud, _ = setup
    enroll(client, key)
    item = challenge(client, "entrada")
    other = ec.generate_private_key(ec.SECP256R1())
    assert sign(client, other, item).status_code == 403
    assert sign(client, key, item).status_code == 409
    item = challenge(client, "entrada")
    assert sign(client, key, item).status_code == 200
    assert face(client, item, user="bob").status_code == 409
    assert face(client, item, name="bob").status_code == 403
    assert not cloud.records


def test_expired_challenge_and_no_face(setup):
    client, key, cloud, db = setup
    item = challenge(client)
    with sqlite3.connect(db) as conn:
        conn.execute("update challenges set expires=?", (time.time() - 1,))
    assert sign(client, key, item).status_code == 409
    item = challenge(client)
    assert sign(client, key, item).status_code == 200
    assert face(client, item, name="invalid").status_code == 422
    assert not cloud.records


def test_no_login_and_no_reset_by_client(setup):
    client, key, _, _ = setup
    assert client.get("/status").status_code == 401
    enroll(client, key)
    assert post(client, "/challenge", {"purpose": "enroll"}).status_code == 409
    assert client.post("/face", content=b"x" * 5_500_001).status_code == 413


def test_challenge_replacement_and_rate_limit(setup):
    client, key, _, _ = setup
    old = challenge(client)
    challenge(client)
    assert sign(client, key, old).status_code == 409
    for _ in range(8): challenge(client)
    assert post(client, "/challenge", {"purpose": "enroll"}).status_code == 429
