import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  try {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const keys = JSON.parse(
      execFileSync(
        npx,
        ["--yes", "supabase", "projects", "api-keys", "--project-ref", "kgxyfphjnaondupjakfj", "-o", "json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
      ),
    );
    serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
  } catch {
    throw new Error(
      "Supabase no está autenticado o tu cuenta no tiene acceso a ATENZA. Ejecuta: npx supabase login",
    );
  }
}
if (!serviceKey)
  throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY solo en el servidor.");
const python = resolve(root, "biometric-server/.venv/Scripts/python.exe");
if (!existsSync(python))
  throw new Error("Prepara biometric-server/.venv siguiendo BIOMETRIA.md.");
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "app:create_app",
    "--factory",
    "--host",
    "127.0.0.1",
    "--port",
    "8787",
    "--no-access-log",
  ],
  {
    cwd: resolve(root, "biometric-server"),
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_URL: "https://kgxyfphjnaondupjakfj.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill());
