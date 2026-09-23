import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { admin } from "./cloud-client.mjs";
const path = ".secrets/accesos-atenza.txt";
if (existsSync(path)) throw new Error("Los accesos ya existen. No se sobrescriben contraseñas.");
mkdirSync(".secrets", { recursive: true });
const rows = ["ATENZA · Accesos de demostración", "http://localhost:8081", "Correos de demostración sin buzón: no admiten recuperación por correo.", ""];
for (const [role, email, name] of [
  ["admin", "admin@atenza.example", "Administrador ATENZA"],
  ["member", "usuario@atenza.example", "Usuario de demostración"],
  ["display", "pantalla@atenza.example", "Pantalla principal"],
]) {
  const password = randomBytes(18).toString("base64url") + "aA7!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  rows.push(`${role.toUpperCase()}\nCorreo: ${email}\nContraseña: ${password}\n`);
  writeFileSync(path, rows.join("\n"), { encoding: "utf8", mode: 0o600 });
  const updated = await admin.from("atenza_profiles").update({ role }).eq("id", data.user.id);
  if (updated.error) throw updated.error;
  console.log(`Cuenta ${role} creada. Acceso guardado localmente.`);
}
