import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";

type Props = {
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
  rideId?: string | null;
};

/**
 * Bottom overlay: centered minimap, Navigate action in the center column,
 * Clips gallery on the left with a balanced spacer on the right.
 */
export function NavigationHUD({ lat, lng, heading, speedMps, rideId }: Props) {
  const router = useRouter();

  const openMaps = () => {
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  const openGallery = () => {
    if (rideId) {
      router.push({ pathname: "/gallery", params: { rideId } });
    } else {
      router.push("/gallery");
    }
  };

  const kmh = speedMps * 3.6;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <MapView
        style={styles.map}
        pointerEvents="none"
        rotateEnabled={false}
        scrollEnabled={false}
        pitchEnabled={false}
        zoomEnabled={false}
        region={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} />
      </MapView>

      <Text style={styles.speed}>
        {kmh.toFixed(0)} km/h · {Math.round(((heading % 360) + 360) % 360)}°
      </Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.sideCell} onPress={openGallery}>
          <Text style={styles.sideLabel}>CLIPS</Text>
        </Pressable>
        <Pressable style={styles.centerCell} onPress={openMaps}>
          <Text style={styles.navLabel}>NAVIGATE</Text>
        </Pressable>
        <View style={styles.sideCell} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  map: {
    width: 156,
    height: 112,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    marginBottom: 8,
    alignSelf: "center",
  },
  speed: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "rgba(226,232,240,0.85)",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    gap: 6,
  },
  sideCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  centerCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.55)",
    backgroundColor: "rgba(10,10,11,0.82)",
    minHeight: 44,
  },
  sideLabel: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: "#a5f3fc",
  },
  navLabel: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: "#f8fafc",
  },
});
