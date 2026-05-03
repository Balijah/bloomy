import {
  useGetFarmProfile,
  useGetAgricultureInsights,
  useGetFarmProfiles,
  useGetLocations,
  useGetAlerts,
  getGetFarmProfileQueryKey,
  getGetAgricultureInsightsQueryKey,
  getGetLocationsQueryKey,
  getGetAlertsQueryKey,
  getGetFarmProfilesQueryKey,
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
  const { data: insights, isLoading: insightsLoading } =
    useGetAgricultureInsights(farmId, {
      query: {
        enabled: !!farmId,
        queryKey: getGetAgricultureInsightsQueryKey(farmId),
      },
    });
  const { data: allLocations } = useGetLocations();
  const { data: allFarms } = useGetFarmProfiles();
  const { data: alerts } = useGetAlerts({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetFarmProfileQueryKey(farmId) }),
      queryClient.invalidateQueries({ queryKey: getGetAgricultureInsightsQueryKey(farmId) }),
      queryClient.invalidateQueries({ queryKey: getGetFarmProfilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey({}) }),
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
        },
        locationName,
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
  }, [profile, insights, allLocations, sharing]);

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

  if (!profile || !insights) {
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
        <SprayWindowCard insights={insights} />
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

      {/* Risk Assessment */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Risk Assessment</Text>
        <View style={{ gap: 10 }}>
          <RiskCard
            title="Frost Risk"
            level={insights.frostRisk?.level}
            description={insights.frostRisk?.description}
            icon="thermometer-outline"
          />
          <RiskCard
            title="Heat Stress"
            level={insights.heatStressRisk?.level}
            description={insights.heatStressRisk?.description}
            icon="sunny-outline"
          />
          <RiskCard
            title="Drought Risk"
            level={insights.droughtRisk?.level}
            description={insights.droughtRisk?.description}
            icon="leaf-outline"
          />
          {insights.harvestDisruptionRisk && (
            <RiskCard
              title="Harvest Risk"
              level={insights.harvestDisruptionRisk?.level}
              description={insights.harvestDisruptionRisk?.description}
              icon="cloud-offline-outline"
            />
          )}
        </View>
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
