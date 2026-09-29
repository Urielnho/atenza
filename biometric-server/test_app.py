import base64
import sqlite3
import time

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import create_app


class FakeCloud:
    def __init__(self):
        self.records = []

    def user(self, token):
        if token not in ("alice", "bob"):
            raise HTTPException(401)
        return token

    def record(self, user, purpose):
        self.records.append((user, purpose))
        return "attendance-id"


@pytest.fixture
def setup(tmp_path):
    cloud = FakeCloud()
    db = tmp_path / "test.sqlite3"
    client = TestClient(create_app(db, cloud))
    key = ec.generate_private_key(ec.SECP256R1())
    return client, key, cloud, db


def post(client, path, body, user="alice"):
    return client.post(path, json=body, headers={"Authorization": "Bearer " + user})


def challenge(client, purpose="entrada", user="alice"):
    result = post(client, "/challenge", {"purpose": purpose}, user)
    assert result.status_code == 200, result.text
    return result.json()


def sign(client, key, item, user="alice"):
    public = key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return post(client, "/fingerprint", {
        "id": item["id"],
        "publicKey": base64.b64encode(public).decode(),
        "signature": base64.b64encode(key.sign(item["challenge"].encode(), ec.ECDSA(hashes.SHA256()))).decode(),
    }, user)


def test_first_fingerprint_links_device_and_records(setup):
    client, key, cloud, db = setup
    result = sign(client, key, challenge(client))
    assert result.status_code == 200
    assert result.json()["recorded"] is True
    with sqlite3.connect(db) as connection:
        assert connection.execute("select count(*) from fingerprint_devices").fetchone()[0] == 1
    assert cloud.records == [("alice", "entrada")]


def test_same_key_records_next_operation_and_blocks_replay(setup):
    client, key, cloud, _ = setup
    assert sign(client, key, challenge(client)).status_code == 200
    item = challenge(client, "salida")
    assert sign(client, key, item).status_code == 200
    assert sign(client, key, item).status_code == 409
    assert cloud.records == [("alice", "entrada"), ("alice", "salida")]


def test_wrong_device_key_is_rejected_and_consumes_challenge(setup):
    client, key, cloud, _ = setup
    assert sign(client, key, challenge(client)).status_code == 200
    item = challenge(client, "salida")
    other = ec.generate_private_key(ec.SECP256R1())
    assert sign(client, other, item).status_code == 403
    assert sign(client, key, item).status_code == 409
    assert cloud.records == [("alice", "entrada")]


def test_challenge_belongs_to_user_and_expires(setup):
    client, key, cloud, db = setup
    item = challenge(client)
    assert sign(client, key, item, "bob").status_code == 409
    with sqlite3.connect(db) as connection:
        connection.execute("update challenges set expires=?", (time.time() - 1,))
    assert sign(client, key, item).status_code == 409
    assert not cloud.records


def test_requires_login_and_rejects_invalid_purpose(setup):
    client, _, _, _ = setup
    assert client.post("/challenge", json={"purpose": "entrada"}).status_code == 401
    assert post(client, "/challenge", {"purpose": "enroll"}).status_code == 422
    assert client.post("/fingerprint", content=b"x" * 20_001).status_code == 413


def test_expo_go_compatibility_records_authenticated_user(setup):
    client, _, cloud, _ = setup
    result = post(client, "/expo-go-fingerprint", {"purpose": "entrada"})
    assert result.status_code == 200
    assert result.json()["recorded"] is True
    assert cloud.records == [("alice", "entrada")]


def test_challenge_replacement_and_rate_limit(setup):
    client, key, _, _ = setup
    old = challenge(client)
    challenge(client)
    assert sign(client, key, old).status_code == 409
    for _ in range(8):
        challenge(client)
    assert post(client, "/challenge", {"purpose": "entrada"}).status_code == 429
