import { PropsWithChildren, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
export const colors = {
  ink: "#14243B",
  muted: "#72808F",
  accent: "#168C95",
  line: "#E2E8EC",
  bg: "#F5F7F9",
};
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        focused && { borderColor: colors.accent, borderWidth: 3 },
      ]}
    >
      <Text
        style={{
          color: secondary ? colors.ink : "white",
          fontWeight: "600",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  secret = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secret?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secret}
        autoCapitalize="none"
        multiline={multiline}
        style={[s.input, multiline && { minHeight: 100 }]}
      />
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={s.card}>{children}</View>;
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 32,
    gap: 24,
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: colors.muted,
  },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 28,
    gap: 20,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.ink,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  secondary: { backgroundColor: "#EAF0F3" },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "white",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  heading: { fontSize: 22, fontWeight: "600", color: colors.ink },
});
