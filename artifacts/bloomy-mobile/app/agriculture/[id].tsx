import {
  useGetFarmProfile,
  useGetAgricultureInsights,
  useGetFarmProfiles,
  useGetLocations,
  useGetAlerts,
  useGetInputCosts,
  useGetYieldRecords,
  useGetFarmRiskHistory,
  getGetFarmProfileQueryKey,
  getGetAgricultureInsightsQueryKey,
  getGetLocationsQueryKey,
  getGetAlertsQueryKey,
  getGetFarmProfilesQueryKey,
  getGetInputCostsQueryKey,
  getGetYieldRecordsQueryKey,
  getGetFarmRiskHistoryQueryKey,
} from "@workspace/api-client-react";
import type {
  AgricultureInsightsDailyTemp,
  AgricultureInsightsDailyPrecip,
} from "@workspace/api-client-react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import FarmMap from "@/components/FarmMap";
import CropCalendar from "@/components/CropCalendar";
import PrecipChart from "@/components/PrecipChart";
import TempChart from "@/components/TempChart";
import WindChart from "@/components/WindChart";
import UVChart from "@/components/UVChart";
import CropStageTracker from "@/components/CropStageTracker";
import YieldForecastCard from "@/components/YieldForecastCard";
import SoilHealthCard from "@/components/SoilHealthCard";
import FrostCountdownCard from "@/components/FrostCountdownCard";
import SprayWindowCard from "@/components/SprayWindowCard";
import IrrigationCard from "@/components/IrrigationCard";
import ScoutingLogCard from "@/components/ScoutingLogCard";
import DiseaseRiskCard from "@/components/DiseaseRiskCard";
import PlantingDateCard from "@/components/PlantingDateCard";
import YieldGoalCard from "@/components/YieldGoalCard";
import YieldHistoryCard from "@/components/YieldHistoryCard";
import InsuranceCard from "@/components/InsuranceCard";
import InputCostCard from "@/components/InputCostCard";
import RiskHistoryCard from "@/components/RiskHistoryCard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { generateFarmReportHtml } from "@/lib/farmReport";

const RISK_COLORS: Record<string, string> = {
  critical: "#F23030",
  high: "#F07030",
  moderate: "#EAAC30",
  low: "#3D9A50",
  none: "#6E736E",
};

function RiskCard({
  title,
  level,
  description,
  icon,
}: {
  title: string;
  level?: string;
  description?: string;
  icon: string;
}) {
  const colors = useColors();
  const color = RISK_COLORS[level?.toLowerCase() ?? "none"] ?? RISK_COLORS.none;
  return (
    <View
      style={[rc(colors).card, { borderLeftColor: color }]}
      testID={`risk-card-${title}`}
    >
      <View style={rc(colors).top}>
        <View style={[rc(colors).icon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rc(colors).label}>{title}</Text>
          <View
            style={[
              rc(colors).levelBadge,
              { backgroundColor: color + "22" },
            ]}
          >
            <Text style={[rc(colors).levelText, { color }]}>
              {level ?? "Unknown"}
            </Text>
          </View>
        </View>
      </View>
      {description && <Text style={rc(colors).desc}>{description}</Text>}
    </View>
  );
}

const rc = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      padding: 14,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 6,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 14,
      fontFamily: "Outfit_500Medium",
      color: colors.foreground,
    },
    levelBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 4,
    },
    levelText: {
      fontSize: 12,
      fontFamily: "Outfit_600SemiBold",
      textTransform: "capitalize",
    },
    desc: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
  });

// ─── 7-day risk timeline ──────────────────────────────────────────────────────

type DayRisk = "critical" | "high" | "moderate" | null;

function frostDayRisk(tempMin: number | undefined | null): DayRisk {
  if (tempMin == null) return null;
  if (tempMin < 28) return "critical";
  if (tempMin < 32) return "high";
  if (tempMin < 36) return "moderate";
  return null;
}

function heatDayRisk(tempMax: number | undefined | null): DayRisk {
  if (tempMax == null) return null;
  if (tempMax > 108) return "critical";
  if (tempMax > 100) return "high";
  if (tempMax > 90)  return "moderate";
  return null;
}

function droughtDayRisk(precipChance: number | undefined | null): DayRisk {
  if (precipChance == null) return null;
  if (precipChance < 5)  return "critical";
  if (precipChance < 15) return "high";
  if (precipChance < 25) return "moderate";
  return null;
}

const RISK_DOT_PALETTE: Record<string, Record<string, string>> = {
  frost:   { moderate: "#3B7DD8", high: "#1A4E9A", critical: "#0D2B6B" },
  heat:    { moderate: "#E06020", high: "#C03010", critical: "#8B1A00" },
  drought: { moderate: "#D08020", high: "#B84010", critical: "#8B2000" },
};

function RiskTimelineRow({
  icon,
  label,
  palette,
  signals,
}: {
  icon: string;
  label: string;
  palette: Record<string, string>;
  signals: DayRisk[];
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", width: 72, gap: 4 }}>
        <Ionicons name={icon as any} size={13} color={palette.moderate} />
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: palette.moderate,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {signals.map((sig, i) => {
          const dotColor = sig ? palette[sig] : null;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: dotColor ? dotColor + "D0" : "#00000012",
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PeakRiskCallout({
  temperatureDaily,
  precipitationDaily,
  showFrost,
  showHeat,
  showDrought,
}: {
  temperatureDaily: AgricultureInsightsDailyTemp[];
  precipitationDaily: AgricultureInsightsDailyPrecip[];
  showFrost: boolean;
  showHeat: boolean;
  showDrought: boolean;
}) {
  const days7 = temperatureDaily.slice(0, 7);

  function dayLabel(i: number, isNight: boolean): string {
    if (i === 0) return isNight ? "tonight" : "today";
    if (i === 1) return isNight ? "tomorrow night" : "tomorrow";
    const d = new Date(days7[i].date + "T12:00:00");
    const name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    return isNight ? `${name} night` : name;
  }

  const callouts: Array<{
    sentence: string;
    color: string;
    icon: string;
    recommendation: string;
  }> = [];

  if (showFrost) {
    let worstIdx = -1;
    let worstTemp = Infinity;
    days7.forEach((td, i) => {
      if (td.tempMin != null && td.tempMin < 36 && td.tempMin < worstTemp) {
        worstTemp = td.tempMin;
        worstIdx = i;
      }
    });
    if (worstIdx >= 0) {
      const color =
        worstTemp < 28 ? "#0D2B6B" : worstTemp < 32 ? "#1A4E9A" : "#3B7DD8";
      const recommendation =
        worstTemp < 28
          ? `Move potted plants indoors and cover all sensitive crops ${dayLabel(worstIdx, true)} — hard freeze expected.`
          : worstTemp < 32
          ? `Cover frost-sensitive crops ${dayLabel(worstIdx, true)} before temperatures drop below freezing.`
          : `Monitor overnight temperatures and be ready to protect frost-sensitive crops.`;
      callouts.push({
        sentence: `Frost risk peaks ${dayLabel(worstIdx, true)} (${Math.round(worstTemp)}°F low)`,
        color,
        icon: "snow-outline",
        recommendation,
      });
    }
  }

  if (showHeat) {
    let worstIdx = -1;
    let worstTemp = -Infinity;
    days7.forEach((td, i) => {
      if (td.tempMax != null && td.tempMax > 90 && td.tempMax > worstTemp) {
        worstTemp = td.tempMax;
        worstIdx = i;
      }
    });
    if (worstIdx >= 0) {
      const color =
        worstTemp > 108 ? "#8B1A00" : worstTemp > 100 ? "#C03010" : "#E06020";
      const recommendation =
        worstTemp > 108
          ? `Maximize irrigation ${dayLabel(worstIdx, false)} and delay field operations until temperatures ease.`
          : worstTemp > 100
          ? `Increase irrigation frequency and avoid midday field work ${dayLabel(worstIdx, false)}.`
          : `Ensure adequate soil moisture and watch for wilting during peak afternoon heat.`;
      callouts.push({
        sentence: `Heat stress peaks ${dayLabel(worstIdx, false)} (${Math.round(worstTemp)}°F high)`,
        color,
        icon: "thermometer-outline",
        recommendation,
      });
    }
  }

  if (showDrought) {
    let worstIdx = -1;
    let worstChance = Infinity;
    precipitationDaily.slice(0, 7).forEach((pd, i) => {
      if (
        pd.precipitationProbability != null &&
        pd.precipitationProbability < 25 &&
        pd.precipitationProbability < worstChance
      ) {
        worstChance = pd.precipitationProbability;
        worstIdx = i;
      }
    });
    if (worstIdx >= 0) {
      const color =
        worstChance < 5 ? "#8B2000" : worstChance < 15 ? "#B84010" : "#D08020";
      const recommendation =
        worstChance < 5
          ? `Irrigate now — virtually no rainfall expected through ${dayLabel(worstIdx, false)}.`
          : worstChance < 15
          ? `Plan an irrigation cycle before ${dayLabel(worstIdx, false)} to maintain crop health.`
          : `Monitor soil moisture closely and consider irrigation if levels are running low.`;
      callouts.push({
        sentence: `Driest day is ${dayLabel(worstIdx, false)} (${Math.round(worstChance)}% chance of rain)`,
        color,
        icon: "warning-outline",
        recommendation,
      });
    }
  }

  if (callouts.length === 0) return null;

  return (
    <View style={{ gap: 6 }}>
      {callouts.map(({ sentence, color, icon, recommendation }, i) => (
        <View
          key={i}
          style={{
            backgroundColor: color + "12",
            borderLeftWidth: 3,
            borderLeftColor: color,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={icon as any} size={14} color={color} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: "Outfit_600SemiBold",
                color,
                lineHeight: 18,
              }}
            >
              {sentence}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_400Regular",
              color,
              lineHeight: 17,
              opacity: 0.85,
              paddingLeft: 22,
            }}
          >
            {recommendation}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RiskTimeline7Day({
  temperatureDaily,
  precipitationDaily,
  showFrost,
  showHeat,
  showDrought,
}: {
  temperatureDaily: AgricultureInsightsDailyTemp[];
  precipitationDaily: AgricultureInsightsDailyPrecip[];
  showFrost: boolean;
  showHeat: boolean;
  showDrought: boolean;
}) {
  const days = temperatureDaily.slice(0, 7).map((td, i) => {
    const precip = precipitationDaily[i];
    const d = new Date(td.date + "T12:00:00");
    const dayLabel =
      i === 0
        ? "Today"
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      dayLabel,
      dateLabel,
      frost:   frostDayRisk(td.tempMin),
      heat:    heatDayRisk(td.tempMax),
      drought: droughtDayRisk(precip?.precipitationProbability),
    };
  });

  return (
    <View
      style={{
        backgroundColor: "#00000006",
        borderWidth: 1,
        borderColor: "#00000010",
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color: "#888",
          marginBottom: 10,
        }}
      >
        7-Day Risk Forecast
      </Text>

      {showFrost && (
        <RiskTimelineRow
          icon="snow-outline"
          label="Frost"
          palette={RISK_DOT_PALETTE.frost}
          signals={days.map((d) => d.frost)}
        />
      )}
      {showHeat && (
        <RiskTimelineRow
          icon="thermometer-outline"
          label="Heat"
          palette={RISK_DOT_PALETTE.heat}
          signals={days.map((d) => d.heat)}
        />
      )}
      {showDrought && (
        <RiskTimelineRow
          icon="warning-outline"
          label="Drought"
          palette={RISK_DOT_PALETTE.drought}
          signals={days.map((d) => d.drought)}
        />
      )}

      {/* Day labels */}
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        <View style={{ width: 72 }} />
        {days.map((day, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_500Medium",
                color: "#999",
              }}
            >
              {day.dayLabel.substring(0, 3)}
            </Text>
            <Text
              style={{
                fontSize: 9,
                fontFamily: "Outfit_400Regular",
                color: "#BBB",
              }}
            >
              {day.dateLabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AgricultureDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id) : 0;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);

  const { data: profile, isLoading: profileLoading } = useGetFarmProfile(
    farmId,
    { query: { enabled: !!farmId, queryKey: getGetFarmProfileQueryKey(farmId) } }
  );
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } =
    useGetAgricultureInsights(farmId, {
      query: {
        enabled: !!farmId,
        queryKey: getGetAgricultureInsightsQueryKey(farmId),
      },
    });
  const { data: allLocations } = useGetLocations();
  const { data: allFarms } = useGetFarmProfiles();
  const { data: alerts } = useGetAlerts({});
  const { data: inputCosts = [] } = useGetInputCosts(farmId, {
    query: { enabled: !!farmId, queryKey: getGetInputCostsQueryKey(farmId) },
  });
  const { data: yieldRecords = [] } = useGetYieldRecords(farmId, {
    query: { enabled: !!farmId, queryKey: getGetYieldRecordsQueryKey(farmId) },
  });
  const { data: riskHistory = [], isLoading: riskHistoryLoading } =
    useGetFarmRiskHistory(farmId, undefined, {
      query: {
        enabled: !!farmId,
        queryKey: getGetFarmRiskHistoryQueryKey(farmId),
      },
    });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetFarmProfileQueryKey(farmId) }),
      queryClient.invalidateQueries({ queryKey: getGetAgricultureInsightsQueryKey(farmId) }),
      queryClient.invalidateQueries({ queryKey: getGetFarmProfilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey({}) }),
      queryClient.invalidateQueries({ queryKey: getGetFarmRiskHistoryQueryKey(farmId) }),
    ]);
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [queryClient, farmId]);

  const handleShare = useCallback(async () => {
    if (!profile || !insights || sharing) return;
    try {
      setSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const locationName =
        allLocations?.find((l) => l.id === profile.locationId)?.name ?? null;
      const html = generateFarmReportHtml({
        profile: {
          name: profile.name,
          cropType: profile.cropType,
          acreage: profile.acreage,
          soilType: profile.soilType,
          plantingDate: profile.plantingDate,
          harvestDate: profile.harvestDate,
          notes: profile.notes,
          costPerAcre: profile.costPerAcre,
          yieldGoal: profile.yieldGoal,
        },
        locationName,
        inputCosts: inputCosts.map((c) => ({
          id: c.id,
          category: c.category,
          item: c.item,
          costPerAcre: c.costPerAcre ?? null,
          totalCost: c.totalCost ?? null,
          acresApplied: c.acresApplied ?? null,
          notes: c.notes ?? null,
        })),
        yieldRecords: yieldRecords.map((r) => ({
          id: r.id,
          harvestYear: r.harvestYear,
          actualYield: r.actualYield,
          notes: r.notes ?? null,
        })),
        insights: {
          growingDegreeDaysForecast: insights.growingDegreeDaysForecast,
          soilMoisture: insights.soilMoisture,
          evapotranspiration7Day: insights.evapotranspiration7Day,
          precipitationForecast: insights.precipitationForecast,
          precipitationDeficit: insights.precipitationDeficit,
          nextFrostDate: insights.nextFrostDate,
          frostRisk: insights.frostRisk as any,
          heatStressRisk: insights.heatStressRisk as any,
          droughtRisk: insights.droughtRisk as any,
          harvestDisruptionRisk: insights.harvestDisruptionRisk as any,
          temperatureDaily: insights.temperatureDaily as any,
          precipitationDaily: insights.precipitationDaily as any,
          windDaily: insights.windDaily as any,
          uvDaily: insights.uvDaily as any,
          recommendations: insights.recommendations as any,
        },
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${profile.name} — Farm Report`,
        UTI: "com.adobe.pdf",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_err) {
      // sharing cancelled or unsupported — silently ignore
    } finally {
      setSharing(false);
    }
  }, [profile, insights, allLocations, inputCosts, yieldRecords, sharing]);

  const isLoading = profileLoading || insightsLoading;

  // Prepare map data
  const mapLocations = useMemo(
    () =>
      (allLocations ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
      })),
    [allLocations]
  );

  const mapFarms = useMemo(
    () =>
      (allFarms ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        cropType: f.cropType,
        locationId: f.locationId,
      })),
    [allFarms]
  );

  const mapAlerts = useMemo(
    () =>
      (alerts ?? []).map((a) => ({
        isRead: a.isRead,
        severity: a.severity,
      })),
    [alerts]
  );

  // Resolve coordinates for the current farm
  const currentLocation = useMemo(
    () => allLocations?.find((l) => l.id === profile?.locationId),
    [allLocations, profile]
  );

  const s = styles(colors, insets);

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

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Ionicons
          name="warning-outline"
          size={48}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            marginTop: 16,
          }}
        >
          Profile not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
          testID="button-back"
        >
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Outfit_500Medium",
              color: colors.primary,
            }}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!insights) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Platform.OS === "web" ? 34 + 16 : insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={topPad}
          />
        }
      >
        <View style={[s.header, { paddingTop: topPad + 16 }]}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            testID="button-back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{profile.name}</Text>
            <Text style={s.subtitle}>
              {profile.cropType
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>
        </View>

        <View style={s.section}>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
              padding: 18,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.muted,
                marginBottom: 12,
              }}
            >
              <Ionicons name="cloud-offline-outline" size={26} color={colors.primary} />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Outfit_600SemiBold",
                color: colors.foreground,
                textAlign: "center",
              }}
            >
              Weather insights unavailable
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
                textAlign: "center",
                lineHeight: 20,
                marginTop: 8,
              }}
            >
              The farm profile was saved, but Bloomy could not load crop-risk insights for it yet.
            </Text>
            <Pressable
              onPress={() => refetchInsights()}
              style={({ pressed }) => [
                {
                  marginTop: 16,
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius,
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                },
                pressed && { opacity: 0.8 },
              ]}
              testID="button-retry-insights"
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Outfit_600SemiBold",
                  color: "#fff",
                }}
              >
                Retry insights
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  }

  const moisturePct = Math.min(100, Math.max(0, insights.soilMoisture ?? 0));
  const showMap =
    currentLocation != null && mapLocations.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom:
          Platform.OS === "web" ? 34 + 16 : insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressViewOffset={topPad}
        />
      }
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          testID="button-back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{profile.name}</Text>
          <Text style={s.subtitle}>
            {profile.cropType
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [s.editBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/agriculture/edit/${farmId}`);
          }}
          testID="button-edit-farm"
        >
          <Ionicons name="create-outline" size={17} color={colors.foreground} />
          <Text style={[s.editBtnText, { color: colors.foreground }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            s.shareBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.75 },
            sharing && { opacity: 0.6 },
          ]}
          onPress={handleShare}
          disabled={sharing}
          testID="button-share-report"
        >
          {sharing ? (
            <ActivityIndicator size={15} color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={17} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* Map — shows all farm locations with alert overlay */}
      {showMap && (
        <View style={s.mapWrapper}>
          <Text style={s.sectionLabel}>Farm Locations</Text>
          <FarmMap
            currentLocationId={currentLocation.id}
            locations={mapLocations}
            farms={mapFarms}
            alerts={mapAlerts}
          />
        </View>
      )}

      {/* GDD Hero */}
      <View style={s.gddCard}>
        <MaterialCommunityIcons
          name="sprout-outline"
          size={32}
          color={colors.primary}
        />
        <Text style={s.gddValue}>
          {insights.growingDegreeDaysForecast ?? "—"}
        </Text>
        <Text style={s.gddLabel}>
          Growing Degree Days (15-day forecast)
        </Text>
      </View>

      {/* Risk Alerts — active risks only, sorted by severity */}
      {(() => {
        const candidates = [
          { title: "Frost Risk",    risk: insights.frostRisk,             icon: "snow-outline"          },
          { title: "Heat Stress",   risk: insights.heatStressRisk,        icon: "thermometer-outline"   },
          { title: "Drought Risk",  risk: insights.droughtRisk,           icon: "warning-outline"       },
          { title: "Harvest Risk",  risk: insights.harvestDisruptionRisk, icon: "cloud-offline-outline" },
        ] as const;

        const SEVERITY_ORDER = ["critical", "high", "moderate", "low", "none"] as const;

        const active = candidates
          .filter(({ risk }) => {
            const lvl = risk?.level;
            return lvl === "moderate" || lvl === "high" || lvl === "critical";
          })
          .sort(
            (a, b) =>
              SEVERITY_ORDER.indexOf(a.risk?.level as any) -
              SEVERITY_ORDER.indexOf(b.risk?.level as any)
          );

        return (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Risk Alerts</Text>
            {active.length === 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#3D9A5015",
                  borderWidth: 1,
                  borderColor: "#3D9A5040",
                  borderRadius: colors.radius,
                  padding: 14,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#3D9A50" />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_500Medium",
                    color: "#3D9A50",
                    flex: 1,
                  }}
                >
                  All risks within safe levels
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {active.map(({ title, risk, icon }) => (
                  <RiskCard
                    key={title}
                    title={title}
                    level={risk?.level}
                    description={risk?.description}
                    icon={icon}
                  />
                ))}
                {insights.temperatureDaily && insights.temperatureDaily.length > 0 && (
                  <>
                    <PeakRiskCallout
                      temperatureDaily={insights.temperatureDaily}
                      precipitationDaily={insights.precipitationDaily ?? []}
                      showFrost={active.some((a) => a.title === "Frost Risk")}
                      showHeat={active.some((a) => a.title === "Heat Stress")}
                      showDrought={active.some((a) => a.title === "Drought Risk")}
                    />
                    <RiskTimeline7Day
                      temperatureDaily={insights.temperatureDaily}
                      precipitationDaily={insights.precipitationDaily ?? []}
                      showFrost={active.some((a) => a.title === "Frost Risk")}
                      showHeat={active.some((a) => a.title === "Heat Stress")}
                      showDrought={active.some((a) => a.title === "Drought Risk")}
                    />
                  </>
                )}
              </View>
            )}
          </View>
        );
      })()}

      {/* Planting & Harvest Tracker */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Planting Tracker</Text>
        <PlantingDateCard profile={profile} insights={insights} />
      </View>

      {/* Growth Stage Tracker */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Growth Stage</Text>
        <CropStageTracker
          cropType={profile.cropType}
          accumulatedGDD={insights.accumulatedGDD}
          farmId={farmId}
        />
      </View>

      {/* Yield Goal */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Yield Goal</Text>
        <YieldGoalCard profile={profile} insights={insights} />
      </View>

      {/* Yield History */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Yield History</Text>
        <YieldHistoryCard
          farmProfileId={farmId}
          cropType={profile.cropType}
          yieldGoal={profile.yieldGoal}
        />
      </View>

      {/* Input Cost Tracker */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Input Costs</Text>
        <InputCostCard
          farmProfileId={farmId}
          farmAcreage={profile.acreage}
          estimateCostPerAcre={profile.costPerAcre}
        />
      </View>

      {/* Crop Insurance */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Crop Insurance</Text>
        <InsuranceCard profile={profile} insights={insights} />
      </View>

      {/* Yield Forecast */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Yield Forecast</Text>
        <YieldForecastCard insights={insights} />
      </View>

      {/* Soil Health */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Soil Health</Text>
        <SoilHealthCard insights={insights} />
      </View>

      {/* Frost Countdown */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Frost Countdown</Text>
        <FrostCountdownCard insights={insights} cropType={profile.cropType} />
      </View>

      {/* Spray Windows */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Spray Windows</Text>
        <SprayWindowCard
          insights={insights}
          lat={currentLocation?.lat}
          lng={currentLocation?.lng}
        />
      </View>

      {/* Irrigation */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Irrigation</Text>
        <IrrigationCard insights={insights} cropType={profile.cropType} />
      </View>

      {/* Disease Risk Map */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Disease Risk</Text>
        <DiseaseRiskCard
          insights={insights}
          currentLocationId={showMap ? currentLocation.id : undefined}
          locations={showMap ? mapLocations : []}
          farms={showMap ? mapFarms : []}
        />
      </View>

      {/* Scouting Log */}
      <View style={s.section}>
        <ScoutingLogCard farmProfileId={farmId} farmName={profile.name} />
      </View>

      {/* Crop Calendar */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Crop Calendar</Text>
        <CropCalendar
          farmId={farmId}
          plantingDate={profile.plantingDate}
          harvestDate={profile.harvestDate}
          nextFrostDate={insights.nextFrostDate}
        />
      </View>


      {/* Soil & Moisture */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Soil & Moisture</Text>
        <View style={s.moistureCard}>
          <View style={s.moistureRow}>
            <Text style={s.moistureLabel}>Soil Moisture</Text>
            <Text style={s.moistureValue} testID="text-soil-moisture">
              {insights.soilMoisture != null
                ? `${insights.soilMoisture.toFixed(1)}%`
                : "N/A"}
            </Text>
          </View>
          <View style={s.progressBg}>
            <View
              style={[s.progressFill, { width: `${moisturePct}%` as any }]}
            />
          </View>

          {insights.evapotranspiration7Day != null && (
            <View style={[s.moistureRow, { marginTop: 16 }]}>
              <Text style={s.moistureLabel}>7-Day Evapotranspiration</Text>
              <Text style={s.moistureValue} testID="text-et">
                {insights.evapotranspiration7Day.toFixed(2)} in
              </Text>
            </View>
          )}
          {insights.precipitationForecast != null && (
            <View style={[s.moistureRow, { marginTop: 12 }]}>
              <Text style={s.moistureLabel}>7-Day Precip Forecast</Text>
              <Text style={s.moistureValue} testID="text-precip">
                {insights.precipitationForecast.toFixed(2)} in
              </Text>
            </View>
          )}
          {insights.nextFrostDate && (
            <View style={s.frostAlert}>
              <Ionicons name="snow-outline" size={16} color="#5B9BDE" />
              <Text style={s.frostText}>
                Next frost: {insights.nextFrostDate}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Temperature Chart */}
      {insights.temperatureDaily && insights.temperatureDaily.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Temperature Forecast</Text>
          <TempChart data={insights.temperatureDaily} />
        </View>
      )}

      {/* UV Index Chart */}
      {insights.uvDaily && insights.uvDaily.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>UV Index Forecast</Text>
          <UVChart data={insights.uvDaily} />
        </View>
      )}

      {/* Wind Chart */}
      {insights.windDaily && insights.windDaily.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Wind Forecast</Text>
          <WindChart data={insights.windDaily} />
        </View>
      )}

      {/* Precipitation Chart */}
      {insights.precipitationDaily && insights.precipitationDaily.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Precipitation Forecast</Text>
          <PrecipChart data={insights.precipitationDaily} />
        </View>
      )}

      {/* Recommendations */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recommendations</Text>
          <View style={{ gap: 10 }}>
            {insights.recommendations.map((rec, i) => (
              <View key={i} style={s.recCard} testID={`rec-${i}`}>
                <View style={s.recIcon}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={s.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Risk History */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Risk History</Text>
        <RiskHistoryCard
          history={riskHistory}
          isLoading={riskHistoryLoading}
        />
      </View>

      {/* Share Report footer CTA */}
      <View style={s.shareFooter}>
        <Pressable
          style={({ pressed }) => [
            s.shareFooterBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
            sharing && { opacity: 0.6 },
          ]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={18} color="#fff" />
          )}
          <Text style={s.shareFooterBtnText}>
            {sharing ? "Generating PDF…" : "Share Farm Report"}
          </Text>
        </Pressable>
        <Text style={[s.shareFooterHint, { color: colors.mutedForeground }]}>
          Exports a one-page PDF summary of conditions, risks, and 7-day forecast
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = (
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
      marginTop: 2,
    },
    title: {
      fontSize: 24,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 3,
      textTransform: "capitalize",
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      marginTop: 2,
    },
    editBtnText: {
      fontSize: 13,
      fontFamily: "Outfit_600SemiBold",
    },
    mapWrapper: {
      marginHorizontal: 16,
      marginTop: 16,
      gap: 8,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Outfit_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    gddCard: {
      margin: 16,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    gddValue: {
      fontSize: 56,
      fontFamily: "Outfit_700Bold",
      color: colors.primary,
    },
    gddLabel: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    section: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Outfit_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    moistureCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    moistureRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    moistureLabel: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    moistureValue: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
    },
    progressBg: {
      height: 8,
      backgroundColor: colors.muted,
      borderRadius: 4,
      marginTop: 10,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#5B9BDE",
      borderRadius: 4,
    },
    frostAlert: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#5B9BDE22",
      borderRadius: colors.radius,
      padding: 10,
      marginTop: 14,
    },
    frostText: {
      fontSize: 13,
      fontFamily: "Outfit_500Medium",
      color: "#5B9BDE",
    },
    recCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    recIcon: { marginTop: 1 },
    recText: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.foreground,
      lineHeight: 21,
    },
    shareBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    shareFooter: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      gap: 8,
    },
    shareFooterBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: colors.radius,
    },
    shareFooterBtnText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: "#fff",
    },
    shareFooterHint: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      textAlign: "center",
      lineHeight: 17,
    },
  });
