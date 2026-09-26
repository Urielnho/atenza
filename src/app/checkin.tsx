import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Card, s } from "../components/ui";
import { useData } from "../lib/store";
import { formatRecordDate } from "../lib/time";
import {
  biometricRequest,
  cancelFingerprint,
  hasFingerprintModule,
  verifyFingerprint,
} from "../lib/biometrics";
type Purpose = "enroll" | "entrada" | "salida";
export default function Checkin() {
  const { session } = useData();
  return <CheckinSession key={session?.user.id ?? "signed-out"} />;
}
function CheckinSession() {
  const { session, profile, attendance, refresh } = useData();
  const userId = session?.user.id;
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"idle" | "fingerprint" | "face">("idle");
  const [purpose, setPurpose] = useState<Purpose>("entrada");
  const [consent, setConsent] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const challenge = useRef<string | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const focused = useIsFocused();
  const available =
    Platform.OS === "android" && !Platform.isTV && hasFingerprintModule;
  const cancel = useCallback(() => {
    generation.current++;
    cancelFingerprint();
    challenge.current = null;
    lock.current = false;
    setBusy(false);
    setStep("idle");
    setCameraReady(false);
  }, []);
  useEffect(() => {
    // Cancel the native operation immediately when this screen loses focus.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!focused) cancel();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
    });
    return () => {
      listener.remove();
      cancel();
    };
  }, [focused, cancel]);
  async function loadStatus() {
    setMessage("");
    try {
      const status = await biometricRequest<{ enrolled: boolean }>("/status");
      setEnrolled(status.enrolled);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo consultar tu registro facial.",
      );
    }
  }
  useEffect(() => {
    if (!userId || profile?.role !== "member" || !available) return;
    let active = true;
    biometricRequest<{ enrolled: boolean }>("/status")
      .then((result) => {
        if (active) setEnrolled(result.enrolled);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [userId, profile?.role, available]);
  async function begin(next: Purpose) {
    if (!session || lock.current || (next === "enroll" && !consent)) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const run = ++generation.current;
    try {
      if (!permission?.granted && !(await requestPermission()).granted)
        throw new Error("Permite usar la cámara para verificar tu rostro.");
      if (run !== generation.current) return;
      setPurpose(next);
      setStep("fingerprint");
      const id = await verifyFingerprint(session.user.id, next);
      if (run !== generation.current) return;
      challenge.current = id;
      setCameraReady(false);
      setStep("face");
    } catch (error) {
      if (run === generation.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo verificar la huella.",
        );
        setStep("idle");
      }
    } finally {
      if (run === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const captureRef = useRef<() => Promise<void>>(async () => {});
  async function capture() {
    if (lock.current || !challenge.current || !camera.current || !cameraReady)
      return;
    lock.current = true;
    setBusy(true);
    const run = generation.current;
    try {
      const picture = await camera.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: false,
      });
      if (run !== generation.current) return;
      if (!picture?.base64) throw new Error("No se pudo capturar el rostro.");
      await biometricRequest("/face", {
        id: challenge.current,
        image: picture.base64,
        consent: purpose === "enroll" && consent,
      });
      if (run !== generation.current) return;
      setMessage(
        purpose === "enroll"
          ? "Rostro registrado. Ya puedes registrar tu asistencia."
          : `${purpose === "entrada" ? "Entrada" : "Salida"} registrada.`,
      );
      if (purpose === "enroll") setEnrolled(true);
      else await refresh();
    } catch (error) {
      if (run === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo verificar tu rostro.",
        );
    } finally {
      if (run === generation.current) {
        challenge.current = null;
        lock.current = false;
        setBusy(false);
        setStep("idle");
      }
    }
  }
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => {
    // Take the photo automatically: a short countdown lets the person
    // settle in front of the camera and the exposure adjust.
    if (step !== "face" || !cameraReady || !focused) return;
    let left = 3;
    const tick = setInterval(() => {
      left -= 1;
      if (left > 0) return setCountdown(left);
      clearInterval(tick);
      setCountdown(null);
      void captureRef.current();
    }, 1000);
    return () => {
      clearInterval(tick);
      setCountdown(null);
    };
  }, [step, cameraReady, focused]);
  return (
    <Shell>
      <Text style={s.title}>Mi asistencia</Text>
      <View style={{ maxWidth: 650, width: "100%", gap: 24 }}>
        <Card>
          <Text style={s.heading}>
            {step === "face"
              ? "Paso 2 de 2 · Rostro"
              : step === "fingerprint"
                ? "Paso 1 de 2 · Huella"
                : "Huella y rostro"}
          </Text>
          {!session ? (
            <Button
              title="Iniciar sesión"
              onPress={() => router.push("/login")}
            />
          ) : profile?.role !== "member" ? (
            <Text style={s.muted}>
              Usa una cuenta de usuario para registrar asistencia.
            </Text>
          ) : !available ? (
            <Text style={s.muted}>
              Abre la versión Android de ATENZA para verificar huella y rostro.
            </Text>
          ) : (
            <>
              {step === "idle" && enrolled === null && (
                <Button
                  secondary
                  title="Consultar registro facial"
                  onPress={() => void loadStatus()}
                />
              )}
              {step === "idle" && enrolled === false && (
                <>
                  <Text style={s.muted}>
                    Registra tu rostro una vez. Se guardará una plantilla facial
                    cifrada en el servicio de ATENZA. La fotografía no se
                    conserva en el servidor. Puedes solicitar a administración
                    eliminar la plantilla.
                  </Text>
                  <Button
                    secondary
                    title={
                      consent
                        ? "✓ Acepto registrar mi plantilla facial"
                        : "Aceptar el registro facial"
                    }
                    onPress={() => setConsent(!consent)}
                  />
                  <Button
                    title="Registrar mi rostro"
                    disabled={!consent || busy}
                    onPress={() => void begin("enroll")}
                  />
                </>
              )}
              {step === "idle" && enrolled === true && (
                <>
                  <Text style={s.muted}>
                    Confirma tu huella y después mira a la cámara.
                  </Text>
                  <View style={s.row}>
                    <Button
                      title="Registrar entrada"
                      disabled={busy}
                      onPress={() => void begin("entrada")}
                    />
                    <Button
                      secondary
                      title="Registrar salida"
                      disabled={busy}
                      onPress={() => void begin("salida")}
                    />
                  </View>
                </>
              )}
              {step === "fingerprint" && (
                <Text style={s.muted}>
                  Coloca tu dedo en el sensor de huella.
                </Text>
              )}
              {step === "face" && focused && (
                <>
                  <Text style={s.muted}>
                    Mira de frente a la cámara, con buena iluminación.
                  </Text>
                  <CameraView
                    ref={camera}
                    facing="front"
                    mode="picture"
                    style={{ height: 320, width: "100%", borderRadius: 16 }}
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={() => {
                      cancel();
                      setMessage("No se pudo abrir la cámara.");
                    }}
                  />
                  <Text accessibilityRole="alert" style={s.heading}>
                    {busy
                      ? "Verificando tu rostro…"
                      : !cameraReady
                        ? "Abriendo la cámara…"
                        : `Capturando en ${countdown ?? 3}…`}
                  </Text>
                </>
              )}
              {step !== "idle" && (
                <Button
                  secondary
                  title="Cancelar"
                  disabled={busy && step === "face"}
                  onPress={cancel}
                />
              )}
            </>
          )}
          {!!message && (
            <Text accessibilityRole="alert" style={s.muted}>
              {message}
            </Text>
          )}
        </Card>
        <Card>
          <Text style={s.heading}>Mis registros</Text>
          <Text style={s.muted}>Hora de Hermosillo</Text>
          {attendance
            .filter((a) => a.user_id === session?.user.id)
            .slice(0, 10)
            .map((a) => (
              <Text key={a.id} style={s.muted}>
                {a.kind.toUpperCase()} · {formatRecordDate(a.created_at)}
              </Text>
            ))}
          {!attendance.some((a) => a.user_id === session?.user.id) && (
            <Text style={s.muted}>Todavía no tienes registros.</Text>
          )}
        </Card>
      </View>
    </Shell>
  );
}
