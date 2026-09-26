import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import { supabase } from "./supabase";
type FingerprintModule = {
  authorize(
    userId: string,
    challenge: string,
  ): Promise<{ publicKey: string; signature: string }>;
  cancel(): Promise<void>;
};
const fingerprint =
  Platform.OS === "android"
    ? requireOptionalNativeModule<FingerprintModule>("AtenzaFingerprint")
    : null;
export const hasFingerprintModule = !!fingerprint;
const base = process.env.EXPO_PUBLIC_BIOMETRIC_URL || "http://127.0.0.1:8787";
export async function biometricRequest<T>(
  path: string,
  body?: object,
): Promise<T> {
  if (!supabase) throw new Error("El servicio de cuentas no está disponible.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Inicia sesión nuevamente.");
  if (
    !base.startsWith("https://") &&
    !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)
  )
    throw new Error("El servicio remoto de biometría debe usar HTTPS.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : "No se pudo verificar la identidad.",
      );
    return result;
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw new Error(
        "No se pudo conectar con la verificación facial. Revisa tu conexión y el servicio.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function verifyFingerprint(
  userId: string,
  purpose: "enroll" | "entrada" | "salida",
) {
  if (!fingerprint)
    throw new Error(
      "Instala la versión Android de ATENZA para usar la huella.",
    );
  const challenge = await biometricRequest<{ id: string; challenge: string }>(
    "/challenge",
    { purpose },
  );
  const proof = await fingerprint.authorize(userId, challenge.challenge);
  await biometricRequest("/fingerprint", { id: challenge.id, ...proof });
  return challenge.id;
}
export const cancelFingerprint = () => {
  void fingerprint?.cancel();
};
