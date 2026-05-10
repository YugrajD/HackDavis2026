import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0b" },
          headerTintColor: "#e2e8f0",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#0a0a0b" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Wi‑Fi capture" }} />
        <Stack.Screen name="gallery" options={{ title: "Saved clips" }} />
      </Stack>
    </>
  );
}
