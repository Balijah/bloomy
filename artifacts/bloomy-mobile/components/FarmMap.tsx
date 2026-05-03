import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface FarmLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface FarmProfile {
  id: number;
  name: string;
  cropType: string;
  locationId: number;
}

export interface AlertSummary {
  isRead: boolean;
  severity?: string | null;
}

interface FarmMapProps {
  currentLocationId: number;
  locations: FarmLocation[];
  farms: FarmProfile[];
  alerts: AlertSummary[];
  circleColorOverride?: string;
}

const SEVERITY_ORDER = ["extreme", "severe", "moderate", "minor"];
const SEVERITY_COLORS: Record<string, string> = {
  extreme: "#F23030",
  severe: "#F07030",
  moderate: "#EAAC30",
  minor: "#5B9BDE",
};

function getTopAlertColor(alerts: AlertSummary[]): string {
  const unread = alerts.filter((a) => !a.isRead);
  for (const sev of SEVERITY_ORDER) {
    if (unread.some((a) => a.severity === sev)) return SEVERITY_COLORS[sev];
  }
  return "#366441";
}

export default function FarmMap({
  currentLocationId,
  locations,
  farms,
  alerts,
  circleColorOverride,
}: FarmMapProps) {
  const colors = useColors();
  const current = locations.find((l) => l.id === currentLocationId);
  const overlayColor = circleColorOverride ?? getTopAlertColor(alerts);
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  function openInMaps() {
    if (!current) return;
    Linking.openURL(`https://maps.google.com/?q=${current.lat},${current.lng}`);
  }

  if (!current) return null;

  return (
    <View style={[s.card, { borderColor: colors.border }]}>
      {unreadCount > 0 && (
        <View style={[s.banner, { backgroundColor: overlayColor }]}>
          <Ionicons name="warning-outline" size={14} color="#fff" />
          <Text style={s.bannerText}>
            {unreadCount} active alert{unreadCount > 1 ? "s" : ""}
          </Text>
        </View>
      )}

      <View style={s.body}>
        <View style={[s.coordBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={[s.coordText, { color: colors.foreground }]}>
            {current.lat.toFixed(4)}°N, {Math.abs(current.lng).toFixed(4)}°W
          </Text>
        </View>

        <View style={[s.fallback, { borderColor: colors.border }]}>
          <View style={[s.fallbackHeader, { backgroundColor: colors.muted }]}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={[s.fallbackTitle, { color: colors.foreground }]}>
              {Constants.appOwnership === "expo"
                ? "Map view unavailable in Expo Go"
                : "Map preview unavailable"}
            </Text>
          </View>
          <Text style={[s.fallbackText, { color: colors.mutedForeground }]}>
            Open in Maps to view the farm location. {locations.length} location
            {locations.length > 1 ? "s" : ""} on this farm.
          </Text>
        </View>

        {locations.length > 1 && (
          <View style={s.otherLocs}>
            {locations.map((loc) => (
              <View key={loc.id} style={s.locRow}>
                <View
                  style={[
                    s.locDot,
                    {
                      backgroundColor:
                        loc.id === currentLocationId ? overlayColor : colors.mutedForeground,
                    },
                  ]}
                />
                <Text style={[s.locName, { color: colors.mutedForeground }]}>
                  {loc.name}
                  {farms.filter((f) => f.locationId === loc.id).length > 0
                    ? ` · ${farms
                        .filter((f) => f.locationId === loc.id)
                        .map((f) => f.name)
                        .join(", ")}`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            s.mapsBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
          ]}
          onPress={openInMaps}
        >
          <Ionicons name="map-outline" size={16} color="#fff" />
          <Text style={s.mapsBtnText}>Open in Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  body: { padding: 14, gap: 12 },
  coordBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  coordText: { fontSize: 13, fontFamily: "Outfit_500Medium" },
  fallback: {
    minHeight: 120,
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
  otherLocs: { gap: 6 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locDot: { width: 8, height: 8, borderRadius: 4 },
  locName: { fontSize: 14, flex: 1, fontFamily: "Outfit_400Regular" },
  mapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 999,
  },
  mapsBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
});