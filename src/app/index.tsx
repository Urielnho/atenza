import { useEffect, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { Shell } from "../components/Shell";
import { Card, colors, s } from "../components/ui";
import { useData } from "../lib/store";
export default function Display() {
  const [now, setNow] = useState(new Date());
  const { notices, attendance, status, session } = useData();
  const { width } = useWindowDimensions();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Shell>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View>
          <Text style={s.label}>ESPACIO CONECTADO</Text>
          <Text style={[s.title, { marginTop: 8 }]}>
            Todo comienza con tu presencia.
          </Text>
        </View>
        <Text style={{ color: colors.accent, fontSize: 13 }}>● {status}</Text>
      </View>
      <View style={{ flexDirection: width > 850 ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1.4, gap: 24 }}>
          <View
            style={{
              backgroundColor: colors.ink,
              padding: 36,
              borderRadius: 22,
              gap: 16,
            }}
          >
            <Text style={{ color: "#A8C2D1", letterSpacing: 2, fontSize: 12 }}>
              BIENVENIDO A ATENZA
            </Text>
            <Text
              style={{
                fontSize: width > 850 ? 88 : 62,
                color: "white",
                fontWeight: "300",
                letterSpacing: -4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {now.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
              <Text
                style={{ fontSize: 24, color: "#8CA4B8", letterSpacing: 0 }}
              >
                {" "}
                {String(now.getSeconds()).padStart(2, "0")}
              </Text>
            </Text>
            <Text style={{ color: "#D8E3EC", fontSize: 18 }}>
              {now.toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: "#34455A",
                marginVertical: 6,
              }}
            />
            <Text style={{ color: "#B7C7D5", lineHeight: 24 }}>
              Registra tu entrada o salida desde ATENZA Móvil.{"\n"}Confirma tu
              identidad con huella o rostro.
            </Text>
          </View>
          <Card>
            <Text style={s.label}>01 / TABLERO DE AVISOS</Text>
            {notices.length ? (
              notices.slice(0, 3).map((n) => (
                <View key={n.id} style={{ gap: 8 }}>
                  <Text style={s.heading}>{n.title}</Text>
                  <Text style={s.muted}>{n.body}</Text>
                </View>
              ))
            ) : (
              <>
                <Text style={s.heading}>Un espacio para estar al día.</Text>
                <Text style={s.muted}>
                  {session
                    ? "Los avisos publicados por administración aparecerán aquí."
                    : "Inicia sesión para consultar los avisos de tu organización."}
                </Text>
              </>
            )}
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Text style={s.label}>02 / ACTIVIDAD RECIENTE</Text>
            <Text style={s.heading}>Cada llegada cuenta.</Text>
            {attendance.length ? (
              attendance.slice(0, 8).map((a) => (
                <View
                  key={a.id}
                  style={[
                    s.row,
                    {
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.line,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      backgroundColor: "#EDF5F5",
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.accent, fontWeight: "600" }}>
                      {(a.profiles?.full_name || "U").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontSize: 16 }}>
                      {a.profiles?.full_name || "Usuario"}
                    </Text>
                    <Text style={s.muted}>
                      {a.kind === "entrada"
                        ? "Entrada registrada"
                        : "Salida registrada"}
                    </Text>
                  </View>
                  <Text style={s.label}>
                    {new Date(a.created_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ))
            ) : (
              <View style={{ paddingVertical: 60, gap: 14 }}>
                <Text style={{ fontSize: 44, color: colors.accent }}>↗</Text>
                <Text style={s.heading}>Listos para comenzar</Text>
                <Text style={s.muted}>
                  Las asistencias aparecerán aquí cuando se registren.
                </Text>
              </View>
            )}
            <Text style={s.muted}>Información actualizada desde la nube.</Text>
          </Card>
        </View>
      </View>
    </Shell>
  );
}
