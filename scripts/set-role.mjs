import { admin } from "./cloud-client.mjs";
const [email, role] = process.argv.slice(2);
if (!email || !["member", "admin", "display"].includes(role))
  throw new Error(
    "Uso: node scripts/set-role.mjs correo rol(member|admin|display)",
  );
let found;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw error;
  found = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found || data.users.length < 100) break;
}
if (!found) throw new Error("Primero crea esa cuenta desde la aplicación.");
const { error } = await admin
  .from("atenza_profiles")
  .update({ role })
  .eq("id", found.id);
if (error) throw error;
console.log(`Rol ${role} asignado. Vuelve a iniciar sesión en ATENZA.`);
