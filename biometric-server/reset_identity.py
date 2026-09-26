"""Administrator-only local maintenance, no public reset endpoint."""
import argparse
from pathlib import Path
import sqlite3
import uuid

parser = argparse.ArgumentParser(description="Eliminar plantilla y vínculo de dispositivo de un usuario")
parser.add_argument("user_id", type=uuid.UUID)
parser.add_argument("--confirm", action="store_true", required=True)
args = parser.parse_args()
with sqlite3.connect(Path(__file__).resolve().parent / "data" / "biometrics.sqlite3") as db:
    db.execute("pragma secure_delete=on")
    db.execute("delete from challenges where user_id=?", (str(args.user_id),))
    count = db.execute("delete from identities where user_id=?", (str(args.user_id),)).rowcount
print(f"Plantillas eliminadas: {count}. El usuario podrá registrar nuevamente su dispositivo y rostro.")
