import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Shell } from "../components/Shell";
import { Button, Card, Field, s } from "../components/ui";
import { supabase } from "../lib/supabase";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!supabase)
      return setMessage(
        "El servicio no está disponible. Contacta a administración.",
      );
    if (!email.trim() || password.length < 8 || (signup && !name.trim()))
      return setMessage(
        "Completa tus datos. La contraseña debe tener al menos 8 caracteres.",
      );
    setBusy(true);
    setMessage("");
    try {
      const result = signup
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) throw result.error;
      if (result.data.session) router.replace("/checkin");
      else
        setMessage(
          "Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <View
        style={{
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
          marginVertical: 24,
        }}
      >
        <Card>
          <Text style={s.title}>
            {signup ? "Crear cuenta" : "Iniciar sesión"}
          </Text>
          {signup && (
            <Field
              label="NOMBRE COMPLETO"
              value={name}
              onChangeText={setName}
            />
          )}
          <Field label="CORREO" value={email} onChangeText={setEmail} />
          <Field
            label="CONTRASEÑA"
            value={password}
            onChangeText={setPassword}
            secret
          />
          {!!message && (
            <Text accessibilityRole="alert" style={s.muted}>
              {message}
            </Text>
          )}
          <Button
            title={
              busy ? "Conectando…" : signup ? "Crear cuenta" : "Iniciar sesión"
            }
            disabled={busy}
            onPress={() => void submit()}
          />
          <Button
            secondary
            title={signup ? "Ya tengo cuenta" : "Crear una cuenta"}
            onPress={() => {
              setSignup(!signup);
              setMessage("");
            }}
          />
        </Card>
      </View>
    </Shell>
  );
}
