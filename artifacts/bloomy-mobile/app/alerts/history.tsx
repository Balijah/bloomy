import {
  useGetAlerts,
  useGetFarmProfiles,
  GetAlertsSeverity,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { format, parseISO, subDays } from "date-fns";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const ALERT_TYPE_ICONS: Record<string, string> = {
  frost: "thermometer-outline",
  hard_freeze: "snow-outline",
  extreme_heat: "flame-outline",
  heat_stress: "sunny-outline",
  heavy_precipitation: "rainy-outline",
  flash_flood: "water-outline",
  drought: "leaf-outline",
  high_wind: "speedometer-outline",
  hail: "cloudy-outline",
  harvest_disruption: "cloud-offline-outline",
  late_season_frost: "thermometer-outline",
  winter_storm: "snow-outline",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#F23030",
  warning: "#F07030",
  watch: "#EAAC30",
  extreme: "#F23030",
  severe: "#F07030",
  moderate: "#EAAC30",
  minor: "#5B9BDE",
};

const SEVERITY_LABELS: Partial<Record<GetAlertsSeverity, string>> = {
  [GetAlertsSeverity.critical]: "Critical",
  [GetAlertsSeverity.warning]: "Warning",
  [GetAlertsSeverity.extreme]: "Extreme",
};

type TimeRange = "all" | "7d" | "30d" | "90d";

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

const SEVERITIES: GetAlertsSeverity[] = [
  GetAlertsSeverity.critical,
  GetAlertsSeverity.warning,
  GetAlertsSeverity.extreme,
];

function getDateFrom(range: TimeRange): string | undefined {
  if (range === "all") return undefined;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return subDays(new Date(), days).toISOString();
}

export default function AlertHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [activeSeverity, setActiveSeverity] = useState<GetAlertsSeverity | null>(null);
  const [activeFarmId, setActiveFarmId] = useState<number | null>(null);

  const { data: farms } = useGetFarmProfiles();

  const dateFrom = getDateFrom(timeRange);
  const hasFilters =
    timeRange !== "all" || activeSeverity !== null || activeFarmId !== null;

  const { data: alerts, isLoading, refetch, isRefetching } = useGetAlerts({
    dateFrom,
    severity: activeSeverity ?? undefined,
    farmProfileId: activeFarmId ?? undefined,
    limit: 200,
  });

  function clearFilters() {
    setTimeRange("all");
    setActiveSeverity(null);
    setActiveFarmId(null);
  }

  const renderChip = useCallback(
    (
      label: string,
      active: boolean,
      onPress: () => void,
      accentColor?: string
    ) => {
      const bg = active
        ? accentColor
          ? accentColor + "22"
          : colors.primary + "18"
        : colors.muted;
      const border = active
        ? accentColor ?? colors.primary
        : colors.border;
      const textCol = active
        ? accentColor ?? colors.primary
        : colors.mutedForeground;
      return (
        <Pressable
          key={label}
          style={[
            st(colors).chip,
            { backgroundColor: bg, borderColor: border },
          ]}
          onPress={onPress}
        >
          <Text style={[st(colors).chipText, { color: textCol }]}>{label}</Text>
        </Pressable>
      );
    },
    [colors]
  );

  const listData = useMemo(() => alerts ?? [], [alerts]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[st(colors).header, { paddingTop: topPad + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            st(colors).backBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={colors.foreground}
          />
        </Pressable>
        <Text style={st(colors).headerTitle}>Alert History</Text>
        {hasFilters && (
          <Pressable
            onPress={clearFilters}
            style={({ pressed }) => [
              st(colors).clearBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={st(colors).clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <View style={st(colors).filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st(colors).filtersRow}
        >
          {/* Time range */}
          {TIME_RANGES.map(({ key, label }) =>
            renderChip(label, timeRange === key, () => setTimeRange(key))
          )}

          {/* Separator */}
          <View style={st(colors).chipDivider} />

          {/* Severity */}
          {SEVERITIES.map((sev) =>
            renderChip(
              SEVERITY_LABELS[sev] ?? sev,
              activeSeverity === sev,
              () =>
                setActiveSeverity((prev) => (prev === sev ? null : sev)),
              SEVERITY_COLORS[sev]
            )
          )}

          {/* Farms (only if multiple farms) */}
          {farms && farms.length > 1 && (
            <>
              <View style={st(colors).chipDivider} />
              {farms.map((farm) =>
                renderChip(
                  farm.name,
                  activeFarmId === farm.id,
                  () =>
                    setActiveFarmId((prev) =>
                      prev === farm.id ? null : farm.id
                    )
                )
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Result count */}
      {!isLoading && (
        <View style={st(colors).countRow}>
          <Text style={st(colors).countText}>
            {listData.length === 0
              ? "No alerts"
              : listData.length === 1
              ? "1 alert"
              : `${listData.length} alerts`}
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={st(colors).loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            st(colors).listContent,
            {
              paddingBottom:
                Platform.OS === "web" ? 84 + 16 : insets.bottom + 32,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={st(colors).empty}>
              <Ionicons
                name="checkmark-circle-outline"
                size={56}
                color={colors.primary}
              />
              <Text style={st(colors).emptyTitle}>No alerts found</Text>
              <Text style={st(colors).emptyText}>
                {hasFilters
                  ? "Try adjusting your filters to see more results."
                  : "No historical alerts for your locations."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const iconName =
              ALERT_TYPE_ICONS[item.type ?? ""] ?? "warning-outline";
            const severityColor =
              SEVERITY_COLORS[item.severity ?? "watch"] ??
              SEVERITY_COLORS.watch;

            const farmName =
              farms?.find((f) => f.id === item.farmProfileId)?.name;

            return (
              <View
                style={[
                  st(colors).alertCard,
                  item.isRead && st(colors).alertCardRead,
                ]}
              >
                <View
                  style={[
                    st(colors).alertIcon,
                    { backgroundColor: severityColor + "22" },
                  ]}
                >
                  <Ionicons
                    name={iconName as any}
                    size={22}
                    color={severityColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={st(colors).alertTop}>
                    <Text
                      style={[
                        st(colors).alertTitle,
                        item.isRead && st(colors).alertTitleRead,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <View
                      style={[
                        st(colors).severityBadge,
                        { backgroundColor: severityColor + "22" },
                      ]}
                    >
                      <Text
                        style={[
                          st(colors).severityBadgeText,
                          { color: severityColor },
                        ]}
                      >
                        {item.severity?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={st(colors).alertMsg} numberOfLines={2}>
                    {item.message}
                  </Text>
                  <View style={st(colors).alertMeta}>
                    <Text style={st(colors).alertTime}>
                      {format(
                        parseISO(item.triggeredAt as unknown as string),
                        "MMM d, yyyy · h:mm a"
                      )}
                    </Text>
                    {farmName && (
                      <View style={st(colors).farmPill}>
                        <Ionicons
                          name="leaf-outline"
                          size={10}
                          color={colors.primary}
                        />
                        <Text style={st(colors).farmPillText}>{farmName}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const st = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
      flex: 1,
    },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    clearBtnText: {
      fontSize: 13,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
    },
    filtersWrapper: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filtersRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 13,
      fontFamily: "Outfit_500Medium",
    },
    chipDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    countRow: {
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    countText: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      padding: 16,
      gap: 10,
    },
    alertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    alertCardRead: { opacity: 0.65 },
    alertIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    alertTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
      flexWrap: "wrap",
    },
    alertTitle: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    alertTitleRead: {
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    severityBadge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    severityBadgeText: {
      fontSize: 10,
      fontFamily: "Outfit_700Bold",
      letterSpacing: 0.5,
    },
    alertMsg: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    alertMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      flexWrap: "wrap",
    },
    alertTime: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    farmPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.primary + "14",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    farmPillText: {
      fontSize: 10,
      fontFamily: "Outfit_500Medium",
      color: colors.primary,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
    },
  });
