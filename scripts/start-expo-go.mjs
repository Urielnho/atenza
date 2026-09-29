import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const isWindows = process.platform === "win32";
let backend = null;
let expo = null;

function adbReverse() {
  const sdk = process.env.ANDROID_HOME ||
    (process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, "Android", "Sdk") : "");
  const adb = sdk ? resolve(sdk, "platform-tools", isWindows ? "adb.exe" : "adb") : "adb";
  if (sdk && !existsSync(adb)) return;
  try {
    execFileSync(adb, ["reverse", "tcp:8787", "tcp:8787"], { stdio: "inherit" });
    execFileSync(adb, ["reverse", "tcp:8081", "tcp:8081"], { stdio: "inherit" });
  } catch {
    console.warn("No se configuró ADB. Enciende el emulador Android y vuelve a ejecutar el comando.");
  }
}

async function healthy() {
  try {
    const response = await fetch("http://127.0.0.1:8787/health");
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await healthy()) return;
    if (backend?.exitCode !== null) throw new Error("El servicio biométrico no pudo iniciar.");
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error("El servicio biométrico tardó demasiado en iniciar.");
}

function stop() {
  expo?.kill("SIGINT");
  backend?.kill("SIGINT");
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

try {
  adbReverse();
  if (!(await healthy())) {
    backend = spawn(process.execPath, [resolve(root, "scripts", "start-biometric-server.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    await waitForBackend();
  }
  const npx = isWindows ? "npx.cmd" : "npx";
  expo = spawn(npx, ["expo", "start", "--go", "--android"], {
    cwd: root,
    stdio: "inherit",
  });
  expo.on("exit", (code) => {
    backend?.kill("SIGINT");
    process.exitCode = code ?? 1;
  });
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
