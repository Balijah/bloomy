import { useGetFarmProfiles, useGetLocations } from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

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

const RISK_COLORS: Record<string, string> = {
  critical: "#F23030",
  high: "#F07030",
  moderate: "#EAAC30",
  low: "#3D9A50",
  none: "#6E736E",
};

function RiskPill({ level, label }: { level?: string; label: string }) {
  const color = RISK_COLORS[level?.toLowerCase() ?? "none"] ?? RISK_COLORS.none;
  return (
    <View style={[riskStyles.pill, { backgroundColor: color + "22", borderColor: color + "44" }]}>
      <View style={[riskStyles.dot, { backgroundColor: color }]} />
      <Text style={[riskStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const riskStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: "Outfit_500Medium" },
});

export default function AgricultureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: profiles, isLoading, refetch, isRefetching } = useGetFarmProfiles();
  const { data: locations } = useGetLocations();

  const locationsMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    locations?.forEach((l) => (map[l.id] = l.name));
    return map;
  }, [locations]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s(colors).header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={s(colors).headerTitle}>My Fields</Text>
          <Text style={s(colors).headerSub}>{profiles?.length ?? 0} farm profile{profiles?.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      <FlatList
        data={profiles ?? []}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={!!(profiles && profiles.length > 0)}
        contentContainerStyle={[
          s(colors).listContent,
          { paddingBottom: Platform.OS === "web" ? 84 + 16 : insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={s(colors).empty}>
            <Ionicons name="leaf-outline" size={56} color={colors.mutedForeground} />
            <Text style={s(colors).emptyTitle}>No farm profiles yet</Text>
            <Text style={s(colors).emptyText}>
              Add your fields to get crop-specific weather insights and growing degree day tracking.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s(colors).card, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/agriculture/${item.id}`);
            }}
            testID={`farm-card-${item.id}`}
          >
            <View style={s(colors).cardHeader}>
              <Text style={s(colors).cropEmoji}>
                {CROP_ICONS[item.cropType] ?? "🌱"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={s(colors).cardTitle}>{item.name}</Text>
                <Text style={s(colors).cardSub}>
                  {item.cropType.replace(/_/g, " ")}
                  {locationsMap[item.locationId] ? ` · ${locationsMap[item.locationId]}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </View>

            {(item.acreage || item.plantingDate) && (
              <View style={s(colors).cardMeta}>
                {item.acreage && (
                  <View style={s(colors).metaChip}>
                    <Ionicons name="resize-outline" size={13} color={colors.mutedForeground} />
                    <Text style={s(colors).metaText}>{item.acreage} ac</Text>
                  </View>
                )}
                {item.plantingDate && (
                  <View style={s(colors).metaChip}>
                    <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                    <Text style={s(colors).metaText}>Planted {item.plantingDate}</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const s = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    listContent: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    cropEmoji: {
      fontSize: 32,
      width: 48,
      height: 48,
      textAlign: "center",
      lineHeight: 48,
      backgroundColor: colors.muted,
      borderRadius: 24,
      overflow: "hidden",
    },
    cardTitle: {
      fontSize: 17,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
    },
    cardSub: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
      textTransform: "capitalize",
    },
    cardMeta: { flexDirection: "row", gap: 8, marginTop: 12 },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    metaText: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 20,
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
