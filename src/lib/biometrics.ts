import { requireOptionalNativeModule } from "expo-modules-core";
import * as LocalAuthentication from "expo-local-authentication";
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
        "No se pudo conectar con el servicio biométrico. Revisa tu conexión y el servicio.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function verifyFingerprint(
  userId: string,
  purpose: "entrada" | "salida",
) {
  if (!fingerprint) {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (!hardware || !enrolled || !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
      throw new Error("Configura una huella en los ajustes de Android.");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirma tu huella",
      cancelLabel: "Cancelar",
      disableDeviceFallback: true,
      biometricsSecurityLevel: "strong",
    });
    if (!result.success)
      throw new Error(result.error === "user_cancel" ? "Verificación cancelada." : "No se pudo verificar la huella.");
    await biometricRequest("/expo-go-fingerprint", { purpose });
    return;
  }
  const challenge = await biometricRequest<{ id: string; challenge: string }>(
    "/challenge",
    { purpose },
  );
  const proof = await fingerprint.authorize(userId, challenge.challenge);
  await biometricRequest("/fingerprint", { id: challenge.id, ...proof });
}
export const cancelFingerprint = () => {
  void fingerprint?.cancel();
  if (!fingerprint && Platform.OS === "android")
    void LocalAuthentication.cancelAuthenticate();
};
