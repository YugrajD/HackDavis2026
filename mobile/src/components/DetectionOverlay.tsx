import { StyleSheet, Text, View } from "react-native";
import type { Detection, MobileHazard } from "../lib/types";
import { colorForSeverity } from "../lib/visuals";

type DetectionOverlayProps = {
  detections: Detection[];
  hazards: MobileHazard[];
};

export function DetectionOverlay({ detections, hazards }: DetectionOverlayProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {detections.map((detection) => {
        const hazard = hazards.find((candidate) => candidate.detection.id === detection.id);
        const color = hazard ? colorForSeverity(hazard.severity) : "#54e6ff";

        return (
          <View
            key={detection.id}
            style={[
              styles.box,
              {
                left: `${detection.bbox.x * 100}%`,
                top: `${detection.bbox.y * 100}%`,
                width: `${detection.bbox.width * 100}%`,
                height: `${detection.bbox.height * 100}%`,
                borderColor: color
              }
            ]}
          >
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>
                {detection.label} {Math.round(detection.confidence * 100)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  badge: {
    position: "absolute",
    top: -26,
    left: -2,
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 5
  },
  badgeText: {
    color: "#061015",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  }
});
