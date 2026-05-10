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
          contentStyle: { backgroundColor: "#0a0a0b" },
          title: "Guardian Road",
        }}
      />
    </>
  );
}
