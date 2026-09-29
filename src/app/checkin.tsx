import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Card, s } from "../components/ui";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
import { formatRecordDate } from "../lib/time";
import { cancelFingerprint, hasFingerprintModule, verifyFingerprint } from "../lib/biometrics";

export default function Checkin() {
  const { session } = useData();
  return <CheckinSession key={session?.user.id ?? "signed-out"} />;
}

function CheckinSession() {
  const { session, profile, attendance, refresh } = useData();
  const userId = session?.user.id;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const focused = useIsFocused();
  const available = Platform.OS === "android" && !Platform.isTV && hasFingerprintModule;

  const cancel = useCallback(() => {
    generation.current++;
    cancelFingerprint();
    lock.current = false;
    setBusy(false);
  }, []);

  useEffect(() => {
    // Cancel the native prompt immediately when this screen loses focus.
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

  async function nextKind(user: string): Promise<"entrada" | "salida"> {
    if (!supabase) throw new Error("El servicio de cuentas no está disponible.");
    const { data, error } = await supabase
      .from("atenza_attendance")
      .select("kind")
      .eq("user_id", user)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error("No se pudo consultar tu último registro. Revisa tu conexión.");
    return data?.[0]?.kind === "entrada" ? "salida" : "entrada";
  }

  async function registerAttendance() {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setMessageType(null);
    const run = ++generation.current;
    try {
      const purpose = await nextKind(session.user.id);
      if (run !== generation.current) return;
      await verifyFingerprint(session.user.id, purpose);
      if (run !== generation.current) return;
      setMessage(`${purpose === "entrada" ? "Entrada" : "Salida"} registrada correctamente.`);
      setMessageType("success");
      await refresh();
    } catch (error) {
      if (run === generation.current) {
        setMessageType("error");
        setMessage(error instanceof Error ? error.message : "No se pudo verificar la huella.");
      }
    } finally {
      if (run === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }

  const next = attendance.find((item) => item.user_id === userId)?.kind === "entrada" ? "salida" : "entrada";

  return (
    <Shell>
      <Text style={s.title}>Mi asistencia</Text>
      <View style={{ maxWidth: 650, width: "100%", gap: 24 }}>
        <Card>
          <Text style={s.heading}>Verificación biométrica</Text>
          {!session ? (
            <Button title="Iniciar sesión" onPress={() => router.push("/login")} />
          ) : profile?.role !== "member" ? (
            <Text style={s.muted}>Usa una cuenta de usuario para registrar asistencia.</Text>
          ) : !available ? (
            <Text style={s.muted}>Abre la versión Android de ATENZA para usar el sensor de huella.</Text>
          ) : (
            <>
              <Text style={s.muted}>Confirma tu huella para registrar tu {next}.</Text>
              <Button
                title={busy ? "Verificando huella…" : "Registrar asistencia"}
                disabled={busy}
                onPress={() => void registerAttendance()}
              />
            </>
          )}
          {!!message && (
            <Text accessibilityRole="alert" style={[s.muted, {
              color: messageType === "error" ? "#B42318" : "#087A55",
              fontWeight: "700",
            }]}>
              {message}
            </Text>
          )}
        </Card>
        <Card>
          <Text style={s.heading}>Mis registros</Text>
          <Text style={s.muted}>Hora de Hermosillo</Text>
          {attendance.filter((item) => item.user_id === session?.user.id).slice(0, 10).map((item) => (
            <Text key={item.id} style={s.muted}>
              {item.kind.toUpperCase()} · {formatRecordDate(item.created_at)}
            </Text>
          ))}
          {!attendance.some((item) => item.user_id === session?.user.id) && (
            <Text style={s.muted}>Todavía no tienes registros.</Text>
          )}
        </Card>
      </View>
    </Shell>
  );
}
