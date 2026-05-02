import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

// ─── helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function parseDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw as any);
  return isNaN(d.getTime()) ? null : startOfDay(d);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const fmt = (d: Date) => d.toLocaleDateString("en-US", FMT);

// ─── pulse animation ────────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: "#fff",
        }}
      />
    </View>
  );
}

// ─── main component ─────────────────────────────────────────────────────────────

interface Props {
  farmId: number;
  plantingDate?: Date | string | null;
  harvestDate?: Date | string | null;
  nextFrostDate?: string | null;
}

export default function CropCalendar({ farmId, plantingDate, harvestDate, nextFrostDate }: Props) {
  const colors = useColors();
  const s = styles(colors);

  const planting = parseDate(plantingDate);
  const harvest = parseDate(harvestDate);
  const frost = parseDate(nextFrostDate);
  const today = startOfDay(new Date());

  // ── empty state ──
  if (!planting && !harvest) {
    return (
      <View style={s.emptyCard}>
        <Ionicons name="calendar-outline" size={28} color={colors.mutedForeground} />
        <Text style={s.emptyTitle}>No season dates set</Text>
        <Text style={s.emptyBody}>
          Add a planting or harvest date in the farm editor to see your crop calendar.
        </Text>
        <Pressable
          style={({ pressed }) => [s.emptyBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/agriculture/edit/${farmId}`);
          }}
        >
          <Ionicons name="create-outline" size={15} color={colors.primaryForeground} />
          <Text style={s.emptyBtnText}>Edit Farm</Text>
        </Pressable>
      </View>
    );
  }

  // ── partial-date state (only one date set) ──
  // Still show stats but no bar
  const hasBar = !!(planting && harvest);
  const totalDays = hasBar
    ? Math.max(1, Math.round((harvest!.getTime() - planting!.getTime()) / 86400000))
    : 0;
  const elapsedDays = hasBar
    ? clamp(Math.round((today.getTime() - planting!.getTime()) / 86400000), 0, totalDays)
    : 0;
  const daysLeft = hasBar ? Math.max(0, totalDays - elapsedDays) : null;
  const progress = hasBar ? elapsedDays / totalDays : 0;

  // Frost: only show if it falls strictly between planting and harvest
  const frostInRange =
    hasBar &&
    frost != null &&
    frost.getTime() > today.getTime() &&
    frost.getTime() > planting!.getTime() &&
    frost.getTime() < harvest!.getTime();
  const frostProgress = frostInRange
    ? clamp((frost!.getTime() - planting!.getTime()) / (harvest!.getTime() - planting!.getTime()), 0.02, 0.98)
    : null;

  // measure bar width for absolute positioning of markers
  const [barWidth, setBarWidth] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  // Status label
  let statusLabel = "";
  let statusColor = colors.primary;
  if (hasBar) {
    if (today < planting!) {
      const daysUntil = Math.round((planting!.getTime() - today.getTime()) / 86400000);
      statusLabel = `Planting in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
      statusColor = colors.mutedForeground;
    } else if (today > harvest!) {
      statusLabel = "Season complete";
      statusColor = colors.mutedForeground;
    } else {
      statusLabel = `Day ${elapsedDays} of ${totalDays}`;
      statusColor = colors.primary;
    }
  }

  return (
    <View style={s.card}>
      {/* ── Stats row ── */}
      <View style={s.statsRow}>
        {planting && (
          <View style={s.statItem}>
            <Ionicons name="leaf-outline" size={14} color={colors.primary} />
            <Text style={s.statLabel}>Planted</Text>
            <Text style={s.statValue}>{fmt(planting)}</Text>
          </View>
        )}
        {hasBar && (
          <View style={[s.statItem, s.statCenter]}>
            <Ionicons name="time-outline" size={14} color={statusColor} />
            <Text style={[s.statLabel, { color: statusColor }]}>Progress</Text>
            <Text style={[s.statValue, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        )}
        {harvest && (
          <View style={[s.statItem, { alignItems: "flex-end" }]}>
            <Ionicons name="basket-outline" size={14} color={colors.primary} />
            <Text style={s.statLabel}>Harvest</Text>
            <Text style={s.statValue}>{fmt(harvest)}</Text>
          </View>
        )}
      </View>

      {/* ── Timeline bar ── */}
      {hasBar && (
        <View style={s.barContainer}>
          {/* track */}
          <View style={s.track} onLayout={onBarLayout}>
            {/* filled */}
            <View
              style={[
                s.filled,
                {
                  width: `${clamp(progress * 100, 0, 100)}%` as any,
                  backgroundColor: today > harvest! ? colors.mutedForeground : colors.primary,
                },
              ]}
            />

            {/* frost marker */}
            {frostProgress != null && barWidth > 0 && (
              <View
                style={[
                  s.frostMarker,
                  { left: frostProgress * barWidth - 10 },
                ]}
                pointerEvents="none"
              >
                <View style={[s.frostPip, { backgroundColor: "#5B9BDE" }]} />
              </View>
            )}

            {/* today dot */}
            {today >= planting! && today <= harvest! && barWidth > 0 && (
              <View
                style={[s.todayMarker, { left: progress * barWidth - 6 }]}
                pointerEvents="none"
              >
                <PulseDot color={colors.primary} />
              </View>
            )}
          </View>

          {/* ── bar labels ── */}
          <View style={s.barLabels}>
            <Text style={s.barLabelLeft}>{fmt(planting!)}</Text>
            {frostInRange && frost && (
              <View
                style={[
                  s.frostLabelWrapper,
                  barWidth > 0
                    ? { left: (frostProgress ?? 0) * barWidth - 36 }
                    : { alignSelf: "center" },
                ]}
              >
                <Ionicons name="snow-outline" size={11} color="#5B9BDE" />
                <Text style={s.frostLabelText}>{fmt(frost)}</Text>
              </View>
            )}
            <Text style={s.barLabelRight}>{fmt(harvest!)}</Text>
          </View>
        </View>
      )}

      {/* ── Days remaining chip ── */}
      {daysLeft != null && daysLeft > 0 && today >= planting! && (
        <View style={s.chipRow}>
          <View style={s.chip}>
            <Ionicons name="hourglass-outline" size={13} color={colors.primary} />
            <Text style={s.chipText}>
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} to harvest
            </Text>
          </View>
          {frostInRange && frost && (
            <View style={[s.chip, { backgroundColor: "#EBF3FB" }]}>
              <Ionicons name="snow-outline" size={13} color="#5B9BDE" />
              <Text style={[s.chipText, { color: "#3A7AB5" }]}>
                Frost {Math.round((frost.getTime() - today.getTime()) / 86400000)}d away
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────────

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 16,
    },
    // empty state
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      marginTop: 4,
    },
    emptyBody: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 19,
    },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 999,
      marginTop: 8,
    },
    emptyBtnText: {
      fontSize: 14,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primaryForeground,
    },
    // stats
    statsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    statItem: {
      flex: 1,
      alignItems: "flex-start",
      gap: 3,
    },
    statCenter: {
      alignItems: "center",
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    statValue: {
      fontSize: 14,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    // bar
    barContainer: {
      gap: 6,
    },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.muted,
      overflow: "visible",
      position: "relative",
    },
    filled: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 4,
    },
    todayMarker: {
      position: "absolute",
      top: -2,
    },
    frostMarker: {
      position: "absolute",
      top: -4,
      alignItems: "center",
    },
    frostPip: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: "#fff",
    },
    barLabels: {
      flexDirection: "row",
      alignItems: "flex-start",
      position: "relative",
      height: 18,
    },
    barLabelLeft: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
      position: "absolute",
      left: 0,
    },
    barLabelRight: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
      position: "absolute",
      right: 0,
    },
    frostLabelWrapper: {
      position: "absolute",
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      top: 0,
    },
    frostLabelText: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: "#5B9BDE",
    },
    // chips
    chipRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primary + "18",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    chipText: {
      fontSize: 12,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primary,
    },
  });
