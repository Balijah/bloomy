import {
  useGetFarmProfiles,
  useGetLocations,
  useDeleteFarmProfile,
  useGetSprayWindowAlerts,
  getGetFarmProfilesQueryKey,
  getGetAgricultureInsightsQueryKey,
  getGetAgricultureInsightsQueryOptions,
  getGetLocationsQueryKey,
  getGetSprayWindowAlertsQueryKey,
  type AgricultureInsights,
  type SprayWindowEntry,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useColors } from "@/hooks/useColors";
import { computeSoilHealth, type SoilHealthResult } from "@/lib/soilHealth";
import { getCurrentStage } from "@/lib/cropStages";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const DELETE_WIDTH = 88;

// ─── Delete action panel (native only) ───────────────────────────────────────

function DeleteAction({
  prog,
  drag,
  onDelete,
}: {
  prog: SharedValue<number>;
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const colors = useColors();

  const animStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      drag.value,
      [-DELETE_WIDTH, 0],
      [0, DELETE_WIDTH],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateX }] };
  });

  const scaleStyle = useAnimatedStyle(() => {
    const scale = interpolate(prog.value, [0, 1], [0.85, 1], Extrapolation.CLAMP);
    const opacity = interpolate(prog.value, [0, 0.5, 1], [0, 0.7, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View style={[ds.deleteOuter, animStyle]}>
      <Pressable
        style={({ pressed }) => [
          ds.deleteBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={onDelete}
      >
        <Animated.View style={[ds.deleteInner, scaleStyle]}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={ds.deleteLabel}>Delete</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const ds = StyleSheet.create({
  deleteOuter: {
    width: DELETE_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F23030",
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteBtn: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteInner: {
    alignItems: "center",
    gap: 4,
  },
  deleteLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
});

// ─── Swipeable farm card ──────────────────────────────────────────────────────

// ─── Spray window badge ───────────────────────────────────────────────────────

const SPRAY_RATING_COLOR: Record<string, string> = {
  ideal: "#2D7A3A",
  good:  "#4D8A5E",
};

function SprayBadge({ window: w }: { window: SprayWindowEntry }) {
  const color = SPRAY_RATING_COLOR[w.rating] ?? "#4D8A5E";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: color + "15",
        borderWidth: 1,
        borderColor: color + "40",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 20,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color,
        }}
      >
        {w.rating === "ideal" ? "Ideal" : "Good"} spray {w.dayLabel === "Today" || w.dayLabel === "Tomorrow" ? w.dayLabel.toLowerCase() : w.dayLabel}
      </Text>
    </View>
  );
}

// ─── Weather summary chip ─────────────────────────────────────────────────────

interface WeatherInfo {
  tempHigh: number;
  precipChance: number;
}

function weatherChipColor(tempHigh: number, precipChance: number): string {
  if (precipChance >= 60) return "#2A6DB8"; // rainy — blue
  if (tempHigh >= 95)    return "#B85A1A"; // heat stress — amber-red
  return "#5A7A5A";                         // neutral — muted green-grey
}

function WeatherChip({ info }: { info: WeatherInfo }) {
  const colors = useColors();
  const color = weatherChipColor(info.tempHigh, info.precipChance);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 20,
      }}
    >
      <Ionicons name="thermometer-outline" size={12} color={color} />
      <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color }}>
        {Math.round(info.tempHigh)}°F
      </Text>
      <View style={{ width: 1, height: 10, backgroundColor: colors.border }} />
      <Ionicons name="water-outline" size={12} color={colors.mutedForeground} />
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: colors.mutedForeground,
        }}
      >
        {info.precipChance}%
      </Text>
    </View>
  );
}

// ─── Growth stage badge ───────────────────────────────────────────────────────

interface StageInfo {
  stageName: string;
  stageIndex: number;
  totalStages: number;
}

function stageBadgeColor(
  stageIndex: number,
  totalStages: number,
  primaryColor: string
): string {
  // Final stage (harvest/maturity) → warm amber; otherwise use primary green
  if (stageIndex === totalStages - 1) return "#B86A1A";
  return primaryColor;
}

function StageBadge({ info }: { info: StageInfo }) {
  const colors = useColors();
  const color = stageBadgeColor(info.stageIndex, info.totalStages, colors.primary);
  // First word of stage name, truncated to 11 chars
  const word = info.stageName.split(/[\s&\/]/)[0];
  const label = word.length > 11 ? word.slice(0, 10) + "." : word;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: color + "15",
        borderWidth: 1,
        borderColor: color + "40",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 20,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Swipeable farm card ──────────────────────────────────────────────────────

interface FarmCardProps {
  item: {
    id: number;
    name: string;
    cropType: string;
    locationId: number;
    acreage?: number | null;
    plantingDate?: string | null;
  };
  locationName?: string;
  soilScore?: SoilHealthResult | null;
  sprayWindow?: SprayWindowEntry | null;
  stageInfo?: StageInfo | null;
  weatherInfo?: WeatherInfo | null;
  onDelete: (id: number, name: string) => void;
}

function SwipeableFarmCard({ item, locationName, soilScore, sprayWindow, stageInfo, weatherInfo, onDelete }: FarmCardProps) {
  const colors = useColors();
  const swipeRef = useRef<SwipeableMethods>(null);

  function handleDelete() {
    swipeRef.current?.close();
    onDelete(item.id, item.name);
  }

  const cardContent = (
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
            {locationName ? ` · ${locationName}` : ""}
          </Text>
        </View>

        {/* On web: show a visible delete icon instead of swipe */}
        {Platform.OS === "web" ? (
          <Pressable
            onPress={() => onDelete(item.id, item.name)}
            style={({ pressed }) => [s(colors).webDeleteBtn, pressed && { opacity: 0.7 }]}
            testID={`button-delete-farm-${item.id}`}
          >
            <Ionicons name="trash-outline" size={17} color="#F23030" />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        )}
      </View>

      {(item.acreage || item.plantingDate || soilScore || sprayWindow || stageInfo || weatherInfo) && (
        <View style={s(colors).cardMeta}>
          {weatherInfo && <WeatherChip info={weatherInfo} />}
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
          {soilScore && (
            <View
              style={[
                s(colors).metaChip,
                {
                  backgroundColor: soilScore.color + "18",
                  borderWidth: 1,
                  borderColor: soilScore.color + "40",
                },
              ]}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: soilScore.color,
                }}
              />
              <Text
                style={[s(colors).metaText, { color: soilScore.color, fontFamily: "Outfit_600SemiBold" }]}
              >
                Soil {soilScore.label}
              </Text>
            </View>
          )}
          {stageInfo && <StageBadge info={stageInfo} />}
          {sprayWindow && <SprayBadge window={sprayWindow} />}
        </View>
      )}
    </Pressable>
  );

  // Web: no swipeable wrapper needed
  if (Platform.OS === "web") {
    return cardContent;
  }

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      enableTrackpadTwoFingerGesture
      rightThreshold={DELETE_WIDTH * 0.55}
      renderRightActions={(prog, drag) => (
        <DeleteAction prog={prog} drag={drag} onDelete={handleDelete} />
      )}
      onSwipeableWillOpen={(direction) => {
        if (direction === "right") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleDelete();
        }
      }}
    >
      {cardContent}
    </ReanimatedSwipeable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AgricultureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: profiles, isLoading, refetch } = useGetFarmProfiles();
  const { data: locations } = useGetLocations();
  const { data: sprayAlerts } = useGetSprayWindowAlerts({
    query: { queryKey: ["sprayWindowAlerts"], staleTime: 10 * 60 * 1000, retry: false },
  });
  const deleteFarmProfile = useDeleteFarmProfile();

  const locationsMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    locations?.forEach((l) => (map[l.id] = l.name));
    return map;
  }, [locations]);

  // Build a map of farmId → best upcoming spray window (ideal preferred over good,
  // today preferred over tomorrow). One entry per farm.
  const sprayWindowMap = React.useMemo(() => {
    const map: Record<number, SprayWindowEntry> = {};
    const windows = sprayAlerts?.upcomingWindows ?? [];
    // Sort: ideal before good, then by date ascending
    const sorted = [...windows].sort((a, b) => {
      if (a.rating === b.rating) return a.date.localeCompare(b.date);
      return a.rating === "ideal" ? -1 : 1;
    });
    sorted.forEach((w) => {
      if (!map[w.farmId]) map[w.farmId] = w;
    });
    return map;
  }, [sprayAlerts]);

  // Read cached agriculture insights and compute the current growth stage client-side.
  // Only shows for farms whose detail screen has been visited at least once (cache hit).
  const stageMap = React.useMemo(() => {
    const map: Record<number, StageInfo | null> = {};
    profiles?.forEach((p) => {
      const key = getGetAgricultureInsightsQueryKey(p.id);
      const cached = queryClient.getQueryData<AgricultureInsights>(key);
      if (cached?.accumulatedGDD != null) {
        const result = getCurrentStage(p.cropType, cached.accumulatedGDD);
        map[p.id] = {
          stageName: result.current.name,
          stageIndex: result.currentIndex,
          totalStages: result.stages.length,
        };
      } else {
        map[p.id] = null;
      }
    });
    return map;
  }, [profiles, queryClient]);

  // Read cached agriculture insights (populated when user visits farm detail screens)
  // and compute the soil health score client-side — zero extra API calls.
  const soilScores = React.useMemo(() => {
    const map: Record<number, SoilHealthResult | null> = {};
    profiles?.forEach((p) => {
      const key = getGetAgricultureInsightsQueryKey(p.id);
      const cached = queryClient.getQueryData<AgricultureInsights>(key);
      if (cached) {
        map[p.id] = computeSoilHealth({
          soilMoisture: cached.soilMoisture,
          evapotranspiration7Day: cached.evapotranspiration7Day,
          precipitationDeficit: cached.precipitationDeficit ?? 0,
          precipitationForecast: cached.precipitationForecast ?? 0,
          droughtRiskLevel: cached.droughtRisk?.level ?? "none",
        });
      } else {
        map[p.id] = null;
      }
    });
    return map;
  }, [profiles, queryClient]);

  // Read today's high temp and precipitation chance from cached insights.
  // temperatureDaily[0] and precipitationDaily[0] both represent today.
  const weatherMap = React.useMemo(() => {
    const map: Record<number, WeatherInfo | null> = {};
    profiles?.forEach((p) => {
      const key = getGetAgricultureInsightsQueryKey(p.id);
      const cached = queryClient.getQueryData<AgricultureInsights>(key);
      const tempHigh = cached?.temperatureDaily?.[0]?.tempMax;
      const precipChance = cached?.precipitationDaily?.[0]?.precipitationProbability;
      if (tempHigh != null && precipChance != null) {
        map[p.id] = { tempHigh, precipChance };
      } else {
        map[p.id] = null;
      }
    });
    return map;
  }, [profiles, queryClient]);

  // Eagerly prefetch agriculture insights for every farm as soon as the profile
  // list is available. prefetchQuery is a no-op for any farm whose cache is
  // still fresh (staleTime 5 min), so revisiting the tab is cheap.
  const prefetchInsights = useCallback(() => {
    if (!profiles?.length) return;
    profiles.forEach((p) => {
      queryClient.prefetchQuery({
        ...getGetAgricultureInsightsQueryOptions(p.id),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [profiles, queryClient]);

  useEffect(() => {
    prefetchInsights();
  }, [prefetchInsights]);

  // Pull-to-refresh: invalidates profiles, locations, spray alerts, and all
  // farm insights in parallel so every badge updates at once.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const insightsInvalidations = (profiles ?? []).map((p) =>
        queryClient.invalidateQueries({
          queryKey: getGetAgricultureInsightsQueryKey(p.id),
        })
      );
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetSprayWindowAlertsQueryKey() }),
        ...insightsInvalidations,
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [profiles, queryClient, refetch]);

  function handleDelete(id: number, name: string) {
    Alert.alert(
      "Delete farm profile?",
      `"${name}" will be permanently removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFarmProfile.mutateAsync({ id });
              await queryClient.invalidateQueries({
                queryKey: getGetFarmProfilesQueryKey(),
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Could not delete this farm profile. Please try again.");
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s(colors).header, { paddingTop: topPad + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s(colors).headerTitle}>My Fields</Text>
          <Text style={s(colors).headerSub}>
            {profiles?.length ?? 0} farm profile{profiles?.length !== 1 ? "s" : ""}
            {Platform.OS !== "web" && (profiles?.length ?? 0) > 0
              ? "  ·  swipe left to delete"
              : ""}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [s(colors).addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/agriculture/new");
          }}
          testID="button-add-farm"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={profiles ?? []}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={!!(profiles && profiles.length > 0)}
        contentContainerStyle={[
          s(colors).listContent,
          {
            paddingBottom:
              Platform.OS === "web" ? 84 + 16 : insets.bottom + 80,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={s(colors).empty}>
            <Ionicons name="leaf-outline" size={56} color={colors.mutedForeground} />
            <Text style={s(colors).emptyTitle}>No farm profiles yet</Text>
            <Text style={s(colors).emptyText}>
              Add your fields to get crop-specific weather insights and growing degree day
              tracking.
            </Text>
            <Pressable
              style={({ pressed }) => [s(colors).emptyBtn, pressed && { opacity: 0.8 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/agriculture/new");
              }}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={s(colors).emptyBtnText}>Add your first farm</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableFarmCard
            item={item}
            locationName={locationsMap[item.locationId]}
            soilScore={soilScores[item.id]}
            sprayWindow={sprayWindowMap[item.id] ?? null}
            stageInfo={stageMap[item.id] ?? null}
            weatherInfo={weatherMap[item.id] ?? null}
            onDelete={handleDelete}
          />
        )}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
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
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
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
    webDeleteBtn: {
      padding: 6,
      marginLeft: 4,
    },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
      gap: 0,
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
      marginBottom: 24,
    },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
    },
    emptyBtnText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: "#fff",
    },
  });
