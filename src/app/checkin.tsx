import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Card, s } from "../components/ui";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
export default function Checkin() {
  const { session, profile, attendance, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function check(kind: "entrada" | "salida") {
    if (lock.current || !supabase || !session) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (Platform.OS === "web" || Platform.isTV)
        throw new Error(
          "Abre ATENZA en tu celular físico para usar huella o rostro.",
        );
      const biometric = await import("expo-local-authentication");
      if (
        !(await biometric.hasHardwareAsync()) ||
        !(await biometric.isEnrolledAsync())
      )
        throw new Error(
          "Configura una huella o rostro compatible en los ajustes de tu celular.",
        );
      const result = await biometric.authenticateAsync({
        promptMessage: `Confirmar ${kind} en ATENZA`,
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
        fallbackLabel: "",
        biometricsSecurityLevel: "strong",
      });
      if (!result.success)
        throw new Error(
          "No se confirmó tu identidad. No se registró asistencia.",
        );
      const { error } = await supabase.rpc("atenza_check_in", { p_kind: kind });
      if (error) throw error;
      setMessage(
        `${kind === "entrada" ? "Entrada" : "Salida"} registrada correctamente.`,
      );
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "No se pudo registrar. Revisa tu conexión.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Shell>
      <Text style={s.label}>ATENZA MÓVIL</Text>
      <Text style={s.title}>
        {profile
          ? `Hola, ${profile.full_name.split(" ")[0]}.`
          : "Tu asistencia, en un toque."}
      </Text>
      <View style={{ maxWidth: 650, gap: 24 }}>
        <Card>
          <Text style={s.heading}>Confirma tu presencia</Text>
          <Text style={s.muted}>
            Usa la huella o el rostro configurado en tu celular para autorizar
            tu entrada o salida.
          </Text>
          {!session ? (
            <Button
              title="Iniciar sesión"
              onPress={() => router.push("/login")}
            />
          ) : (
            <View style={s.row}>
              <Button
                title={busy ? "Verificando…" : "Registrar entrada"}
                disabled={busy || profile?.role !== "member"}
                onPress={() => void check("entrada")}
              />
              <Button
                secondary
                title="Registrar salida"
                disabled={busy || profile?.role !== "member"}
                onPress={() => void check("salida")}
              />
            </View>
          )}
          {profile && profile.role !== "member" && (
            <Text style={s.muted}>
              Esta cuenta administra o muestra el tablero. Usa una cuenta de
              miembro para checar.
            </Text>
          )}
          {Platform.OS === "web" && (
            <Text style={s.muted}>
              La biometría está disponible en la aplicación móvil.
            </Text>
          )}
          {!!message && (
            <Text accessibilityRole="alert" style={s.muted}>
              {message}
            </Text>
          )}
        </Card>
        <Card>
          <Text style={s.label}>MIS ÚLTIMOS REGISTROS</Text>
          {attendance
            .filter((a) => a.user_id === session?.user.id)
            .slice(0, 10)
            .map((a) => (
              <Text key={a.id} style={s.muted}>
                {a.kind.toUpperCase()} ·{" "}
                {new Date(a.created_at).toLocaleString("es-MX")}
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
