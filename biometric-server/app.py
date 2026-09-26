import base64
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path
from threading import Lock
from typing import Literal

import httpx
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from face_engine import FaceEngine

ROOT = Path(__file__).resolve().parent


class ChallengeRequest(BaseModel):
    purpose: Literal["enroll", "entrada", "salida"]


class FingerprintRequest(BaseModel):
    id: str = Field(max_length=100)
    publicKey: str = Field(max_length=2048)
    signature: str = Field(max_length=1024)


class FaceRequest(BaseModel):
    id: str = Field(max_length=100)
    image: str = Field(min_length=100, max_length=5_400_000)
    consent: bool = False


class Cloud:
    def __init__(self):
        self.url = os.environ["SUPABASE_URL"].rstrip("/")
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    def user(self, token):
        try:
            response = httpx.get(self.url + "/auth/v1/user", headers={"apikey": self.key, "Authorization": "Bearer " + token}, timeout=15)
            if response.status_code != 200:
                raise HTTPException(401, "Inicia sesión nuevamente.")
            user_id = response.json()["id"]
            profile = httpx.get(self.url + "/rest/v1/atenza_profiles", params={"id": "eq." + user_id, "select": "role"}, headers=self.headers(), timeout=15)
            profile.raise_for_status()
            if not profile.json() or profile.json()[0]["role"] != "member":
                raise HTTPException(403, "Usa una cuenta de usuario para registrar asistencia.")
            return user_id
        except httpx.HTTPError as error:
            raise HTTPException(503, "No se pudo conectar con el servicio de cuentas.") from error

    def headers(self):
        return {"apikey": self.key, "Authorization": "Bearer " + self.key}

    def record(self, user_id, purpose):
        try:
            response = httpx.post(self.url + "/rest/v1/rpc/atenza_verified_check_in", headers=self.headers(), json={"p_user": user_id, "p_kind": purpose}, timeout=15)
            if response.status_code >= 400:
                message = response.json().get("message", "No se pudo registrar la asistencia.")
                raise HTTPException(409, message if response.status_code < 500 else "No se pudo registrar la asistencia.")
            return response.json()
        except httpx.HTTPError as error:
            raise HTTPException(503, "No se pudo confirmar el registro. Revisa tu historial antes de intentar de nuevo.") from error


def create_app(db_path=None, encryption_key=None, engine=None, cloud=None):
    path = Path(db_path or ROOT / "data" / "biometrics.sqlite3")
    path.parent.mkdir(parents=True, exist_ok=True)
    cipher = Fernet(encryption_key or os.environ["ATENZA_TEMPLATE_KEY"].encode())
    db = sqlite3.connect(path, check_same_thread=False)
    db.row_factory = sqlite3.Row
    lock = Lock()
    db.executescript("""
      create table if not exists identities(user_id text primary key, public_key text not null,
        template blob not null, consent_at real not null);
      create table if not exists challenges(id text primary key, user_id text not null,
        purpose text not null, nonce text not null, expires real not null, state text not null,
        public_key text);
      create index if not exists challenge_user on challenges(user_id);
      create table if not exists attempts(user_id text not null, at real not null);
      create index if not exists attempt_user on attempts(user_id, at);
    """)
    face = engine or FaceEngine(ROOT / "models")
    remote = cloud or Cloud()
    app = FastAPI(title="ATENZA Biometrics", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def limit_body(request, call_next):
        from starlette.responses import JSONResponse
        # Bound actual streamed bytes, including requests without Content-Length.
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 5_500_000:
                return JSONResponse({"detail": "Solicitud demasiado grande."}, status_code=413)
        request._body = bytes(body)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    def user(authorization: str = Header(default="")):
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Inicia sesión.")
        return remote.user(authorization[7:])

    def current(challenge_id, user_id, state):
        row = db.execute("select * from challenges where id=? and user_id=?", (challenge_id, user_id)).fetchone()
        if not row or row["expires"] < time.time() or row["state"] != state:
            raise HTTPException(409, "La verificación venció o ya se utilizó. Comienza de nuevo.")
        return dict(row)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/status")
    def status(user_id=Depends(user)):
        with lock:
            exists = db.execute("select 1 from identities where user_id=?", (user_id,)).fetchone()
        return {"enrolled": bool(exists)}

    @app.post("/challenge")
    def challenge(body: ChallengeRequest, user_id=Depends(user)):
        with lock, db:
            now = time.time()
            db.execute("delete from challenges where expires < ?", (now,))
            db.execute("delete from attempts where at < ?", (now - 600,))
            if db.execute("select count(*) from attempts where user_id=?", (user_id,)).fetchone()[0] >= 10:
                raise HTTPException(429, "Demasiados intentos. Espera diez minutos.")
            identity = db.execute("select 1 from identities where user_id=?", (user_id,)).fetchone()
            if (body.purpose == "enroll") == bool(identity):
                raise HTTPException(409, "El rostro ya está registrado." if identity else "Registra tu rostro primero.")
            db.execute("insert into attempts values (?,?)", (user_id, now))
            db.execute("delete from challenges where user_id=?", (user_id,))
            identifier = secrets.token_urlsafe(24)
            nonce = f"ATENZA|{user_id}|{body.purpose}|{secrets.token_urlsafe(32)}"
            db.execute("insert into challenges values (?,?,?,?,?,?,null)", (identifier, user_id, body.purpose, nonce, now + 120, "pending"))
        return {"id": identifier, "challenge": nonce}

    @app.post("/fingerprint")
    def fingerprint(body: FingerprintRequest, user_id=Depends(user)):
        with lock, db:
            item = current(body.id, user_id, "pending")
            identity = db.execute("select public_key from identities where user_id=?", (user_id,)).fetchone()
            key_text = identity[0] if identity else body.publicKey
            try:
                if key_text != body.publicKey:
                    raise ValueError("Different device key")
                key = serialization.load_der_public_key(base64.b64decode(key_text, validate=True))
                if not isinstance(key, ec.EllipticCurvePublicKey) or not isinstance(key.curve, ec.SECP256R1):
                    raise ValueError("Invalid key type")
                key.verify(base64.b64decode(body.signature, validate=True), item["nonce"].encode(), ec.ECDSA(hashes.SHA256()))
            except Exception as error:
                # Commit invalidation even though the HTTP request fails.
                db.execute("delete from challenges where id=?", (body.id,))
                db.commit()
                raise HTTPException(403, "No se pudo verificar la huella de este dispositivo.") from error
            db.execute("update challenges set state='fingerprint', public_key=? where id=?", (key_text, body.id))
        return {"fingerprintVerified": True}

    @app.post("/face")
    def verify_face(body: FaceRequest, user_id=Depends(user)):
        with lock, db:
            item = current(body.id, user_id, "fingerprint")
            # One attempt per signed challenge; no replay or concurrent duplicate use.
            db.execute("delete from challenges where id=?", (body.id,))
            identity = db.execute("select template from identities where user_id=?", (user_id,)).fetchone()
        if item["purpose"] == "enroll" and not body.consent:
            raise HTTPException(400, "Acepta el registro de tu plantilla facial.")
        try:
            vector = face.embedding(body.image)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        if item["expires"] < time.time():
            raise HTTPException(409, "La verificación venció. Comienza de nuevo.")
        if item["purpose"] == "enroll":
            try:
                with lock, db:
                    db.execute("insert into identities values (?,?,?,?)", (user_id, item["public_key"], cipher.encrypt(json.dumps(vector).encode()), time.time()))
            except sqlite3.IntegrityError as error:
                raise HTTPException(409, "El rostro ya está registrado.") from error
            return {"enrolled": True}
        if not identity or not face.matches(json.loads(cipher.decrypt(identity[0])), vector):
            raise HTTPException(403, "El rostro no coincide. No se registró asistencia.")
        attendance_id = remote.record(user_id, item["purpose"])
        return {"recorded": True, "id": attendance_id}

    return app
