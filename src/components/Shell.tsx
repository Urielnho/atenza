import { PropsWithChildren } from "react";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, colors, s } from "./ui";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
export function Shell({ children }: PropsWithChildren) {
  const { session, profile } = useData();
  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <View
          style={[
            s.row,
            {
              justifyContent: "space-between",
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            },
          ]}
        >
          <View>
            <Text
              style={{
                color: colors.ink,
                fontWeight: "700",
                fontSize: 25,
                letterSpacing: 5,
              }}
            >
              ATENZA<Text style={{ color: colors.accent }}> ·</Text>
            </Text>
            <Text style={[s.label, { fontSize: 9, marginTop: 6 }]}>
              PRESENCIA QUE CONECTA
            </Text>
          </View>
          <View style={s.row}>
            <Button
              secondary
              title="Pantalla"
              onPress={() => router.replace("/")}
            />
            <Button
              secondary
              title="Mi asistencia"
              onPress={() => router.push("/checkin")}
            />
            {profile?.role === "admin" && (
              <Button
                secondary
                title="Administrar"
                onPress={() => router.push("/admin")}
              />
            )}
            <Button
              title={session ? "Cerrar sesión" : "Iniciar sesión"}
              onPress={() => {
                if (session) void supabase?.auth.signOut();
                else router.push("/login");
              }}
            />
          </View>
        </View>
        {children}
        <Text style={[s.label, { fontSize: 10, marginTop: 12 }]}>
          ATENZA / ASISTENCIA Y COMUNICACIÓN
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
