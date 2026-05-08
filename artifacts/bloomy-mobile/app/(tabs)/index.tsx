import {
  useGetCurrentWeather,
  useGetDashboardSummary,
  useGetForecast,
  useGetHourlyForecast,
  useGetLocations,
  useGetMe,
  getGetCurrentWeatherQueryKey,
  getGetForecastQueryKey,
  getGetMeQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetHourlyForecastQueryKey,
  getGetLocationsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { format, parseISO } from "date-fns";
import React, { useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { WeatherIcon } from "@/components/WeatherIcon";

function WeatherStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={statStyles.container}>
      <Ionicons name={icon as any} size={18} color="rgba(250,248,245,0.72)" />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  value: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    color: "#FAF8F5",
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: "rgba(250,248,245,0.68)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const canFetchProtectedData = authLoaded && isSignedIn;
  const { data: user } = useGetMe({
    query: { enabled: canFetchProtectedData, queryKey: getGetMeQueryKey() },
  });
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isRefetching: isSummaryRefetching,
  } =
    useGetDashboardSummary(undefined, {
      query: {
        enabled: canFetchProtectedData,
        queryKey: getGetDashboardSummaryQueryKey(),
      },
    });
  const {
    data: savedLocations,
    isLoading: areLocationsLoading,
    refetch: refetchLocations,
    isRefetching: areLocationsRefetching,
  } = useGetLocations({
    query: {
      enabled: canFetchProtectedData,
      queryKey: getGetLocationsQueryKey(),
    },
  });

  const fallbackLocation = savedLocations?.find((loc) => loc.isDefault) ?? savedLocations?.[0];
  const selectedLocation = summary?.location ?? fallbackLocation;
  const lat = selectedLocation?.lat ?? 0;
  const lng = selectedLocation?.lng ?? 0;
  const hasLocation = !!selectedLocation;
  const isFree = !user?.subscriptionTier || user.subscriptionTier === "free";

  const { data: currentWeather } = useGetCurrentWeather(
    { lat, lng },
    {
      query: {
        enabled: hasLocation && !summary?.location,
        queryKey: getGetCurrentWeatherQueryKey({ lat, lng }),
      },
    }
  );

  const { data: forecast } = useGetForecast(
    { lat, lng },
    { query: { enabled: hasLocation, queryKey: getGetForecastQueryKey({ lat, lng }) } }
  );

  const { data: hourly } = useGetHourlyForecast(
    { lat, lng },
    {
      query: {
        enabled: hasLocation && !isFree,
        queryKey: getGetHourlyForecastQueryKey({ lat, lng }),
      },
    }
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoading = (isSummaryLoading || areLocationsLoading) && !hasLocation;
  const isRefetching = isSummaryRefetching || areLocationsRefetching;
  const refetch = useCallback(() => {
    if (!canFetchProtectedData) return;
    refetchSummary();
    refetchLocations();
  }, [canFetchProtectedData, refetchLocations, refetchSummary]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (isLoading) {
    return (
      <View style={[s(colors).flex, { justifyContent: "center", alignItems: "center", backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasLocation) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={[s(colors).emptyIcon, { marginTop: topPad }]}>
          <Ionicons name="location-outline" size={48} color={colors.mutedForeground} />
        </View>
        <Text style={s(colors).emptyTitle}>No location set</Text>
        <Text style={s(colors).emptyText}>Add a location to see your weather dashboard.</Text>
        <Pressable
          style={({ pressed }) => [s(colors).addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push("/(tabs)/settings")}
          testID="button-add-location"
        >
          <Text style={s(colors).addBtnText}>Go to Settings</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const wx = summary?.location ? summary.currentWeather : currentWeather;
  if (!wx) {
    return (
      <View style={[s(colors).flex, { justifyContent: "center", alignItems: "center", backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const alerts = summary?.activeAlerts ?? [];
  const heroColors = wx.isDay
    ? (["#2F6A40", "#4E9360"] as const)
    : (["#172019", "#2E3D32"] as const);
  const forecastDays = forecast ? (isFree ? forecast.slice(0, 7) : forecast) : [];

  return (
    <View style={[s(colors).flex, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[s(colors).flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{ backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryForeground} />}
      >
        {/* Hero weather card */}
        <LinearGradient
          colors={heroColors}
          style={[s(colors).hero, { paddingTop: topPad + 18 }]}
        >
          {alerts.length > 0 && (
            <View style={s(colors).alertBanner}>
              <Ionicons name="warning" size={14} color="#FAF8F5" />
              <Text style={s(colors).alertBannerText}>{alerts.length} active alert{alerts.length > 1 ? "s" : ""}</Text>
            </View>
          )}
          <View style={s(colors).locationRow}>
            <Ionicons name="location" size={14} color="rgba(250,248,245,0.82)" />
            <Text style={s(colors).locationName}>{selectedLocation.name}</Text>
          </View>
          <View style={s(colors).tempRow}>
            <WeatherIcon code={wx.weatherCode} isDay={wx.isDay} size={56} color="rgba(250,248,245,0.92)" />
            <Text style={s(colors).temp}>{Math.round(wx.temperature)}°</Text>
          </View>
          <Text style={s(colors).description}>{wx.weatherDescription}</Text>
          <Text style={s(colors).feelsLike}>Feels like {Math.round(wx.feelsLike)}°F</Text>

          <View style={s(colors).statsRow}>
            <WeatherStat label="Humidity" value={`${wx.humidity}%`} icon="water" />
            <View style={s(colors).statDivider} />
            <WeatherStat label="Wind" value={`${Math.round(wx.windSpeed)} mph`} icon="speedometer" />
            <View style={s(colors).statDivider} />
            <WeatherStat label="UV" value={`${wx.uvIndex}`} icon="sunny" />
            <View style={s(colors).statDivider} />
            <WeatherStat label="Precip" value={`${wx.precipitation.toFixed(1)} in`} icon="rainy" />
          </View>
        </LinearGradient>

        <View style={s(colors).body}>
          {/* 7/15-day forecast */}
          {forecastDays.length > 0 && (
            <View style={s(colors).section}>
              <Text style={s(colors).sectionTitle}>{isFree ? "7-Day Forecast" : "15-Day Forecast"}</Text>
              <View style={s(colors).forecastCard}>
                {forecastDays.map((d, i) => (
                  <View key={i} style={[s(colors).forecastRow, i > 0 && s(colors).forecastBorder]} testID={`forecast-day-${i}`}>
                    <Text style={s(colors).forecastDay}>
                      {i === 0 ? "Today" : format(parseISO(d.date), "EEE")}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "center", gap: 6 }}>
                      <WeatherIcon code={d.weatherCode} isDay={true} size={18} color={colors.primary} />
                      {d.precipitationProbability > 0 && (
                        <Text style={s(colors).forecastPrecip}>{d.precipitationProbability}%</Text>
                      )}
                    </View>
                    <View style={s(colors).forecastTemps}>
                      <Text style={s(colors).forecastLow}>{Math.round(d.tempMin)}°</Text>
                      <View style={s(colors).tempBar}>
                        <View style={[s(colors).tempBarFill, {
                          left: `${Math.max(0, (d.tempMin / Math.max(1, d.tempMax)) * 50)}%` as any,
                        }]} />
                      </View>
                      <Text style={s(colors).forecastHigh}>{Math.round(d.tempMax)}°</Text>
                    </View>
                  </View>
                ))}
              </View>

              {isFree && (
                <Pressable
                  style={({ pressed }) => [s(colors).upsellCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push("/(tabs)/settings")}
                  testID="button-upgrade-forecast"
                >
                  <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s(colors).upsellTitle}>15-day outlook</Text>
                    <Text style={s(colors).upsellText}>Upgrade to Grower for extended forecasts</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          )}

          {/* Hourly forecast strip */}
          {hourly && hourly.length > 0 && (
            <View style={s(colors).section}>
              <Text style={s(colors).sectionTitle}>Hourly</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s(colors).hourlyScroll}>
                {hourly.slice(0, 24).map((h, i) => (
                  <View key={i} style={s(colors).hourlyItem} testID={`hourly-${i}`}>
                    <Text style={s(colors).hourlyTime}>{format(parseISO(h.time), "ha")}</Text>
                    <WeatherIcon code={h.weatherCode} isDay={h.isDay} size={20} color={colors.primary} />
                    <Text style={s(colors).hourlyTemp}>{Math.round(h.temperature)}°</Text>
                    {h.precipitationProbability > 10 && (
                      <Text style={s(colors).hourlyPrecip}>{h.precipitationProbability}%</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {isFree && !hourly && (
            <View style={s(colors).upsellCard}>
              <Ionicons name="time-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s(colors).upsellTitle}>Hourly forecasts</Text>
                <Text style={s(colors).upsellText}>Upgrade to Grower for 48-hour hourly data</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </View>
          )}

          <View style={{ height: Platform.OS === "web" ? 84 + 16 : insets.bottom + 80 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      paddingHorizontal: 24,
      paddingBottom: 36,
    },
    body: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      marginTop: -20,
      paddingTop: 6,
      minHeight: 420,
    },
    alertBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(242,48,48,0.25)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      alignSelf: "flex-start",
      marginBottom: 16,
    },
    alertBannerText: {
      fontSize: 12,
      fontFamily: "Outfit_500Medium",
      color: "#FAF8F5",
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 16,
    },
    locationName: {
      fontSize: 14,
      fontFamily: "Outfit_500Medium",
      color: "rgba(250,248,245,0.8)",
    },
    tempRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 8,
    },
    temp: {
      fontSize: 72,
      fontFamily: "Outfit_700Bold",
      color: "#FAF8F5",
      lineHeight: 80,
    },
    description: {
      fontSize: 20,
      fontFamily: "Outfit_500Medium",
      color: "#FAF8F5",
      marginBottom: 4,
      textTransform: "capitalize",
    },
    feelsLike: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: "rgba(250,248,245,0.7)",
      marginBottom: 18,
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: "rgba(15,31,21,0.28)",
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "rgba(250,248,245,0.12)",
    },
    statDivider: {
      width: 1,
      backgroundColor: "rgba(250,248,245,0.15)",
      marginVertical: 12,
    },
    section: { paddingHorizontal: 16, paddingTop: 18 },
    sectionTitle: {
      fontSize: 14,
      fontFamily: "Outfit_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 12,
    },
    hourlyScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
    hourlyItem: {
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      marginRight: 8,
      minWidth: 60,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hourlyTime: {
      fontSize: 12,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
    },
    hourlyTemp: {
      fontSize: 18,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    hourlyPrecip: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: "#5B9BDE",
    },
    forecastCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    forecastRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    forecastBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    forecastDay: {
      width: 48,
      fontSize: 15,
      fontFamily: "Outfit_500Medium",
      color: colors.foreground,
    },
    forecastPrecip: {
      fontSize: 12,
      fontFamily: "Outfit_500Medium",
      color: "#5B9BDE",
    },
    forecastTemps: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      width: 110,
      justifyContent: "flex-end",
    },
    forecastLow: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      width: 28,
      textAlign: "right",
    },
    tempBar: {
      flex: 1,
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      overflow: "hidden",
    },
    tempBarFill: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.primary,
      borderRadius: 2,
      opacity: 0.6,
    },
    forecastHigh: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      width: 28,
    },
    upsellCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    upsellTitle: {
      fontSize: 14,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
    },
    upsellText: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 22,
    },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 32,
      paddingVertical: 14,
    },
    addBtnText: {
      fontSize: 16,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primaryForeground,
    },
  });
