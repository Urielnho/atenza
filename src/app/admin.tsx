import { useState } from "react";
import { Text, View } from "react-native";
import { Shell } from "../components/Shell";
import { Button, Card, Field, s } from "../components/ui";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
export default function Admin() {
  const { profile, notices, refresh } = useData();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  async function save() {
    if (!supabase || !title.trim() || !body.trim())
      return setMessage("Escribe un título y un mensaje.");
    setBusy(true);
    try {
      const values = { title: title.trim(), body: body.trim() };
      const { error } = editing
        ? await supabase.from("atenza_notices").update(values).eq("id", editing)
        : await supabase.from("atenza_notices").insert(values);
      if (error) throw error;
      setTitle("");
      setBody("");
      setEditing(null);
      setMessage("Aviso publicado.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from("atenza_notices")
      .delete()
      .eq("id", id);
    setMessage(error ? error.message : "Aviso eliminado.");
    setDeleting(null);
    setBusy(false);
    await refresh();
  }
  return (
    <Shell>
      <Text style={s.title}>Comunicación en tiempo real.</Text>
      {profile?.role !== "admin" ? (
        <Text style={s.muted}>
          Inicia sesión con una cuenta de administración para gestionar avisos.
        </Text>
      ) : (
        <View style={{ gap: 24, maxWidth: 800 }}>
          <Card>
            <Text style={s.heading}>
              {editing ? "Editar aviso" : "Publicar un aviso"}
            </Text>
            <Field label="TÍTULO" value={title} onChangeText={setTitle} />
            <Field
              label="MENSAJE"
              value={body}
              onChangeText={setBody}
              multiline
            />
            <Button
              title={busy ? "Guardando…" : "Publicar en pantalla"}
              disabled={busy}
              onPress={() => void save()}
            />
            {!!message && (
              <Text accessibilityRole="alert" style={s.muted}>
                {message}
              </Text>
            )}
          </Card>
          {notices.map((n) => (
            <Card key={n.id}>
              <Text style={s.heading}>{n.title}</Text>
              <Text style={s.muted}>{n.body}</Text>
              <View style={s.row}>
                <Button
                  secondary
                  title="Editar"
                  disabled={busy}
                  onPress={() => {
                    setEditing(n.id);
                    setTitle(n.title);
                    setBody(n.body);
                  }}
                />
                <Button
                  secondary
                  title={
                    deleting === n.id ? "Confirmar eliminación" : "Eliminar"
                  }
                  disabled={busy}
                  onPress={() =>
                    deleting === n.id ? void remove(n.id) : setDeleting(n.id)
                  }
                />
                {deleting === n.id && (
                  <Button
                    secondary
                    title="Cancelar"
                    onPress={() => setDeleting(null)}
                  />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Shell>
  );
}
