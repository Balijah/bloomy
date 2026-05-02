/**
 * FarmMap — web fallback.
 * Metro picks this file when bundling for web; FarmMap.tsx is used on native.
 */
import { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type {
  AlertSummary,
  FarmLocation,
  FarmProfile,
} from "./FarmMap";

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

  if (!current) return null;

  function openInMaps() {
    Linking.openURL(
      `https://maps.google.com/?q=${current!.lat},${current!.lng}`
    );
  }

  return (
    <View style={[s.card, { borderColor: colors.border }]}>
      {/* Alert banner */}
      {unreadCount > 0 && (
        <View style={[s.banner, { backgroundColor: overlayColor }]}>
          <Ionicons name="warning-outline" size={14} color="#fff" />
          <Text style={s.bannerText}>
            {unreadCount} active alert{unreadCount > 1 ? "s" : ""}
          </Text>
        </View>
      )}

      <View style={s.body}>
        {/* Coordinate badge */}
        <View style={[s.coordBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={[s.coordText, { color: colors.foreground }]}>
            {current.lat.toFixed(4)}°N, {Math.abs(current.lng).toFixed(4)}°W
          </Text>
        </View>

        {/* Other farm locations */}
        {locations.length > 1 && (
          <View style={s.otherLocs}>
            <Text style={[s.otherTitle, { color: colors.mutedForeground }]}>
              All farm locations
            </Text>
            {locations.map((loc) => {
              const isCurrent = loc.id === currentLocationId;
              const locFarms = farms.filter((f) => f.locationId === loc.id);
              return (
                <View key={loc.id} style={s.locRow}>
                  <View
                    style={[
                      s.locDot,
                      {
                        backgroundColor: isCurrent
                          ? overlayColor
                          : colors.mutedForeground,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      s.locName,
                      {
                        color: isCurrent
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: isCurrent
                          ? "Outfit_600SemiBold"
                          : "Outfit_400Regular",
                      },
                    ]}
                  >
                    {loc.name}
                    {locFarms.length > 0
                      ? ` · ${locFarms.map((f) => f.name).join(", ")}`
                      : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Open in maps */}
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
  otherLocs: { gap: 6 },
  otherTitle: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locDot: { width: 8, height: 8, borderRadius: 4 },
  locName: { fontSize: 14, flex: 1 },
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
