import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
};

export function NavigationHUD({ lat, lng, heading, speedMps }: Props) {
  const [expanded, setExpanded] = useState(false);
  const speedKmh = Math.round(speedMps * 3.6);

  return (
    <>
      {/* Top card — speed + cardinal direction */}
      <View style={styles.topCard}>
        <Text style={styles.speedValue}>{speedKmh}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
        <View style={styles.divider} />
        <Text style={styles.cardinalText}>{toCardinal(heading)}</Text>
      </View>

      {/* Centre compass */}
      <View style={styles.compassWrap} pointerEvents="none">
        <View style={styles.compassRing}>
          <Text style={[styles.compassArrow, { transform: [{ rotate: `${heading}deg` }] }]}>
            ↑
          </Text>
        </View>
      </View>

      {/* Bottom-left coordinate card — tap to expand */}
      <Pressable
        style={[styles.coordCard, expanded && styles.coordCardExpanded]}
        onPress={() => setExpanded((e) => !e)}
      >
        <Text style={styles.coordLabel}>LOCATION</Text>
        <Text style={styles.coordValue}>{lat.toFixed(5)}</Text>
        <Text style={styles.coordValue}>{lng.toFixed(5)}</Text>
        {expanded && (
          <>
            <View style={styles.coordDivider} />
            <Text style={styles.coordLabel}>HEADING</Text>
            <Text style={styles.coordValue}>{Math.round(heading)}°</Text>
            <Text style={styles.coordLabel}>SPEED</Text>
            <Text style={styles.coordValue}>{speedKmh} km/h</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

function toCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

const styles = StyleSheet.create({
  topCard: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  speedValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  speedUnit: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cardinalText: {
    color: "#7af1ff",
    fontSize: 20,
    fontWeight: "800",
  },
  compassWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  compassRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  compassArrow: {
    fontSize: 58,
    color: "#ffffff",
    lineHeight: 70,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  coordCard: {
    position: "absolute",
    bottom: 96,
    left: 14,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 10,
    minWidth: 120,
  },
  coordCardExpanded: {
    minWidth: 150,
  },
  coordLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  coordValue: {
    color: "#7af1ff",
    fontSize: 12,
    fontWeight: "700",
  },
  coordDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 6,
  },
});
