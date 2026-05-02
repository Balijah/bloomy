/**
 * FarmMap — native implementation using react-native-maps.
 * Metro picks this file on iOS/Android; FarmMap.web.tsx is picked on web.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
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
}

const SEVERITY_ORDER = ["extreme", "severe", "moderate", "minor"];
const SEVERITY_COLORS: Record<string, string> = {
  extreme: "#F23030",
  severe: "#F07030",
  moderate: "#EAAC30",
  minor: "#5B9BDE",
};
const GEOFENCE_RADIUS_M = 5_000;

const CROP_ICONS: Record<string, string> = {
  corn: "🌽",
  soybeans: "🫘",
  winter_wheat: "🌾",
  cotton: "🌸",
  almonds: "🌰",
  grapes: "🍇",
  apples: "🍎",
  potatoes: "🥔",
  rice: "🌾",
  other: "🌱",
};

function getTopAlertColor(alerts: AlertSummary[]): string {
  const unread = alerts.filter((a) => !a.isRead);
  for (const sev of SEVERITY_ORDER) {
    if (unread.some((a) => a.severity === sev)) {
      return SEVERITY_COLORS[sev];
    }
  }
  return "#366441"; // Bloomy primary green — no active alerts
}

export default function FarmMap({
  currentLocationId,
  locations,
  farms,
  alerts,
}: FarmMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);

  const overlayColor = useMemo(() => getTopAlertColor(alerts), [alerts]);
  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const currentLocation = useMemo(
    () => locations.find((l) => l.id === currentLocationId),
    [locations, currentLocationId]
  );

  // Build a lookup: locationId → farms at that location
  const farmsByLocation = useMemo(() => {
    const map: Record<number, FarmProfile[]> = {};
    for (const f of farms) {
      if (!map[f.locationId]) map[f.locationId] = [];
      map[f.locationId].push(f);
    }
    return map;
  }, [farms]);

  if (!currentLocation) return null;

  const initialRegion = {
    latitude: currentLocation.lat,
    longitude: currentLocation.lng,
    latitudeDelta: 0.14,
    longitudeDelta: 0.14,
  };

  function handleRecenter() {
    mapRef.current?.animateToRegion(initialRegion, 400);
  }

  return (
    <View style={s.wrapper}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={initialRegion}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomEnabled={true}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {locations.map((loc) => {
          const isCurrent = loc.id === currentLocationId;
          const locFarms = farmsByLocation[loc.id] ?? [];
          const label =
            locFarms.length > 0
              ? locFarms.map((f) => f.name).join(", ")
              : loc.name;
          const cropEmoji =
            locFarms.length === 1
              ? (CROP_ICONS[locFarms[0].cropType] ?? "🌱")
              : "📍";

          return (
            <React.Fragment key={`loc-${loc.id}`}>
              {/* Geofence circle */}
              <Circle
                center={{ latitude: loc.lat, longitude: loc.lng }}
                radius={GEOFENCE_RADIUS_M}
                fillColor={
                  isCurrent
                    ? overlayColor + "28" // ~16% opacity
                    : colors.primary + "14" // ~8% opacity for others
                }
                strokeColor={
                  isCurrent
                    ? overlayColor + "88" // ~53% opacity
                    : colors.primary + "44"
                }
                strokeWidth={isCurrent ? 1.5 : 1}
              />

              {/* Farm pin marker */}
              <Marker
                coordinate={{ latitude: loc.lat, longitude: loc.lng }}
                title={label}
                description={locFarms
                  .map((f) =>
                    f.cropType.replace(/_/g, " ").replace(/\b\w/g, (c) =>
                      c.toUpperCase()
                    )
                  )
                  .join(", ")}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    s.pin,
                    isCurrent
                      ? { backgroundColor: overlayColor, borderColor: "#fff" }
                      : { backgroundColor: "#fff", borderColor: colors.border },
                  ]}
                >
                  <Text style={s.pinEmoji}>{cropEmoji}</Text>
                </View>
                {isCurrent && unreadCount > 0 && (
                  <View style={[s.alertBadge, { backgroundColor: overlayColor }]}>
                    <Text style={s.alertBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Alert severity banner */}
      {unreadCount > 0 && (
        <View style={[s.alertBanner, { backgroundColor: overlayColor }]}>
          <Ionicons name="warning-outline" size={13} color="#fff" />
          <Text style={s.alertBannerText}>
            {unreadCount} active alert{unreadCount > 1 ? "s" : ""} for your farms
          </Text>
        </View>
      )}

      {/* Recenter button */}
      <Pressable
        style={({ pressed }) => [s.recenterBtn, pressed && { opacity: 0.8 }]}
        onPress={handleRecenter}
      >
        <Ionicons name="locate-outline" size={18} color="#333" />
      </Pressable>

      {/* Legend dot */}
      <View style={s.legend}>
        <View style={[s.legendDot, { backgroundColor: overlayColor }]} />
        <Text style={s.legendText}>
          {unreadCount > 0 ? "Active alerts" : "All clear"}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    height: 230,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  pinEmoji: { fontSize: 17 },
  alertBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  alertBadgeText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
  alertBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  alertBannerText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  recenterBtn: {
    position: "absolute",
    bottom: 36,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  legend: {
    position: "absolute",
    bottom: 8,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Outfit_500Medium", color: "#333" },
});
