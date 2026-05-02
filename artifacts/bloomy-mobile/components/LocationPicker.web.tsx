/**
 * LocationPicker — web fallback.
 * Lat/lng number inputs + browser Geolocation API "Detect" button.
 * Metro picks this file when bundling for web.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  initialCoords?: { lat: number; lng: number };
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPicker({ initialCoords, onCoordsChange }: Props) {
  const colors = useColors();
  const [lat, setLat] = useState(
    initialCoords ? String(initialCoords.lat) : ""
  );
  const [lng, setLng] = useState(
    initialCoords ? String(initialCoords.lng) : ""
  );
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commit(newLat: string, newLng: string) {
    const la = parseFloat(newLat);
    const ln = parseFloat(newLng);
    if (!isNaN(la) && !isNaN(ln)) {
      onCoordsChange({ lat: la, lng: ln });
      setError(null);
    }
  }

  function handleDetect() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setDetecting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = String(pos.coords.latitude.toFixed(6));
        const ln = String(pos.coords.longitude.toFixed(6));
        setLat(la);
        setLng(ln);
        commit(la, ln);
        setDetecting(false);
      },
      () => {
        setError("Could not detect location. Enter coordinates manually.");
        setDetecting(false);
      },
      { timeout: 10000 }
    );
  }

  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[s.hint, { color: colors.mutedForeground }]}>
        Enter the coordinates for this farm location, or detect automatically.
      </Text>

      <View style={s.row}>
        {/* Latitude */}
        <View style={s.inputGroup}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>Latitude</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={lat}
            onChangeText={(v) => { setLat(v); commit(v, lng); }}
            placeholder="e.g. 41.8827"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Longitude */}
        <View style={s.inputGroup}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>Longitude</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={lng}
            onChangeText={(v) => { setLng(v); commit(lat, v); }}
            placeholder="e.g. -87.6233"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          s.detectBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.8 },
        ]}
        onPress={handleDetect}
        disabled={detecting}
      >
        {detecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="locate" size={16} color="#fff" />
        )}
        <Text style={s.detectText}>
          {detecting ? "Detecting…" : "Use my location"}
        </Text>
      </Pressable>

      {error && (
        <Text style={[s.error, { color: "#F23030" }]}>{error}</Text>
      )}

      {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
        <View style={[s.coordBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          <Text style={[s.coordText, { color: colors.foreground }]}>
            {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 19,
  },
  row: { flexDirection: "row", gap: 12 },
  inputGroup: { flex: 1, gap: 6 },
  label: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  detectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 999,
  },
  detectText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  error: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
  },
  coordBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  coordText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
  },
});
