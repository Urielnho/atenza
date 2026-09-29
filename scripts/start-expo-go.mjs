import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const isWindows = process.platform === "win32";
let expo = null;
let androidSerial = "";

function adbReverse() {
  const sdk = process.env.ANDROID_HOME ||
    (process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, "Android", "Sdk") : "");
  const adb = sdk ? resolve(sdk, "platform-tools", isWindows ? "adb.exe" : "adb") : "adb";
  if (sdk && !existsSync(adb)) return;
  try {
    const devices = execFileSync(adb, ["devices"], { encoding: "utf8" })
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[0] && parts[1] === "device")
      .map((parts) => parts[0]);
    androidSerial = devices.find((serial) => serial.startsWith("emulator-")) || devices[0] || "";
    if (!androidSerial) throw new Error("No Android device");
    execFileSync(adb, ["-s", androidSerial, "reverse", "tcp:8081", "tcp:8081"], { stdio: "inherit" });
    console.log(`Emulador seleccionado: ${androidSerial}`);
  } catch {
    console.warn("No se configuró ADB. Enciende el emulador Android y vuelve a ejecutar el comando.");
  }
}

function stop() {
  expo?.kill("SIGINT");
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
  const npx = isWindows ? "npx.cmd" : "npx";
  expo = spawn(npx, ["expo", "start", "--go", "--android", "--clear"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...(androidSerial ? { ANDROID_SERIAL: androidSerial } : {}) },
  });
  expo.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
