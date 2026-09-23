import { Stack } from "expo-router";
import { Provider } from "../lib/store";
export default function Layout() {
  return (
    <Provider>
      <Stack screenOptions={{ headerShown: false }} />
    </Provider>
  );
}
