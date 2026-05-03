/**
 * LocationPicker — native implementation.
 * Shows a full map with a fixed crosshair pin in the centre.
 * As the user pans the map, coordinates update via onRegionChangeComplete.
 * Metro picks this file on iOS/Android; LocationPicker.web.tsx is used on web.
 */
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as ExpoLocation from "expo-location";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const US_CENTER: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

interface Props {
  initialCoords?: { lat: number; lng: number };
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPicker({ initialCoords, onCoordsChange }: Props) {
  const colors = useColors();
  const mapRef = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  const isExpoGo = Constants.appOwnership === "expo";

  const initial: Region = initialCoords
    ? {
        latitude: initialCoords.lat,
        longitude: initialCoords.lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }
    : US_CENTER;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    initialCoords ?? { lat: US_CENTER.latitude, lng: US_CENTER.longitude }
  );

  function handleRegionChangeComplete(region: Region) {
    const next = { lat: region.latitude, lng: region.longitude };
    setCoords(next);
    onCoordsChange(next);
  }

  async function handleUseMyLocation() {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access in Settings to use your current position."
        );
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const region: Region = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      mapRef.current?.animateToRegion(region, 600);
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      onCoordsChange(next);
    } catch {
      Alert.alert("Error", "Could not get your current location.");
    } finally {
      setLocating(false);
    }
  }

  if (isExpoGo) {
    return (
      <View style={s.wrapper}>
        <View style={[s.fallback, { borderColor: colors.border }]}>
          <View style={[s.fallbackHeader, { backgroundColor: colors.muted }]}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={[s.fallbackTitle, { color: colors.foreground }]}>
              Map picker unavailable in Expo Go
            </Text>
          </View>
          <Text style={[s.fallbackText, { color: colors.mutedForeground }]}>
            Open a development build to choose coordinates on the map.
          </Text>
        </View>

        <View style={[s.coordBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Ionicons name="location-outline" size={12} color="#fff" />
          <Text style={s.coordText}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.wrapper}>
      <View
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Fixed crosshair pin at centre */}
      <View pointerEvents="none" style={s.crosshairWrapper}>
        <View style={[s.pinShadow, { shadowColor: colors.primary }]}>
          <View style={[s.pin, { backgroundColor: colors.primary }]}>
            <Ionicons name="location" size={20} color="#fff" />
          </View>
        </View>
        <View style={[s.pinTip, { backgroundColor: colors.primary }]} />
      </View>

      {/* Use my location button */}
      <Pressable
        style={({ pressed }) => [
          s.locBtn,
          { backgroundColor: "#fff" },
          pressed && { opacity: 0.8 },
        ]}
        onPress={handleUseMyLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={colors.primary} />
        )}
      </Pressable>

      {/* Coordinates readout */}
      <View style={[s.coordBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
        <Ionicons name="location-outline" size={12} color="#fff" />
        <Text style={s.coordText}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    height: 260,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  fallback: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    padding: 14,
    justifyContent: "center",
    gap: 10,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  fallbackTitle: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  fallbackText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 19,
  },
  crosshairWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pinShadow: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    marginBottom: -2,
  },
  pinTip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
    marginTop: 1,
  },
  locBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  coordBadge: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  coordText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
