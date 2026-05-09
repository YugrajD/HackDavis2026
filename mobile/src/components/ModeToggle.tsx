import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RideMode } from "../lib/types";

type ModeToggleProps = {
  mode: RideMode;
  onChange: (mode: RideMode) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === "bike" }}
        style={[styles.segment, mode === "bike" && styles.segmentActive]}
        onPress={() => onChange("bike")}
      >
        <Text style={[styles.label, mode === "bike" && styles.labelActive]}>Bike</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === "car" }}
        style={[styles.segment, mode === "car" && styles.segmentActive]}
        onPress={() => onChange("car")}
      >
        <Text style={[styles.label, mode === "car" && styles.labelActive]}>Car</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(126, 235, 255, 0.32)",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(4, 10, 14, 0.86)"
  },
  segment: {
    minWidth: 76,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  segmentActive: {
    backgroundColor: "rgba(84, 230, 255, 0.18)"
  },
  label: {
    color: "#9db1bb",
    fontSize: 13,
    fontWeight: "800"
  },
  labelActive: {
    color: "#ecfbff"
  }
});
