/**
 * SprayWindowCard — enhanced spray window advisor.
 *
 * Features:
 *  • Application type selector (Herbicide / Pre-Emergent / Pesticide / Foliar Feed)
 *  • 7-day daily rating tiles with type-specific thresholds
 *  • Hourly best-window panel (requires lat/lng, paid-tier graceful fallback)
 *  • Humidity condition row using hourly averages
 *  • Temperature inversion warning
 *  • Per-type agronomic tip
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useGetHourlyForecast } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  computeSprayWindows,
  computeHourlySlots,
  findBestHourlyWindow,
  getSprayTypeInfo,
  SPRAY_TYPES,
  RATING_COLORS,
  isoDate,
  hourOf,
  type SprayDayResult,
  type SprayRating,
  type SprayType,
  type HourlySlot,
} from "@/lib/sprayWindow";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
  lat?: number | null;
  lng?: number | null;
}

// ── Rating icon ───────────────────────────────────────────────────────────────

function RatingIcon({
  rating,
  color,
  size,
}: {
  rating: SprayRating;
  color: string;
  size: number;
}) {
  const iconMap: Record<SprayRating, string> = {
    ideal:    "checkmark-circle",
    good:     "checkmark-circle-outline",
    marginal: "alert-circle-outline",
    poor:     "close-circle-outline",
    avoid:    "close-circle",
  };
  return <Ionicons name={iconMap[rating] as any} size={size} color={color} />;
}

// ── Spray type selector ───────────────────────────────────────────────────────

function SprayTypeSelector({
  selected,
  onChange,
  colors,
}: {
  selected: SprayType;
  onChange: (t: SprayType) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ts.row}
    >
      {SPRAY_TYPES.map((t) => {
        const active = selected === t.key;
        return (
          <Pressable
            key={t.key}
            style={[
              ts.chip,
              {
                backgroundColor: active ? "#366441" : colors.background,
                borderColor: active ? "#366441" : colors.border,
              },
            ]}
            onPress={() => onChange(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={13}
              color={active ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                ts.label,
                { color: active ? "#fff" : colors.mutedForeground },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ts = StyleSheet.create({
  row:   { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  chip:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  label: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
});

// ── Day tile ──────────────────────────────────────────────────────────────────

function DayTile({
  day,
  selected,
  onPress,
}: {
  day: SprayDayResult;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 72,
          borderRadius: 12,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? day.color : colors.border,
          backgroundColor: selected ? day.color + "18" : colors.muted,
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 4,
          gap: 6,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Outfit_600SemiBold",
          color: selected ? day.color : colors.mutedForeground,
          letterSpacing: 0.3,
        }}
      >
        {day.dayLabel.toUpperCase()}
      </Text>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: day.color + (selected ? "30" : "22"),
          borderWidth: 2,
          borderColor: day.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RatingIcon rating={day.rating} color={day.color} size={15} />
      </View>
      <Text
        style={{
          fontSize: 10,
          fontFamily: "Outfit_400Regular",
          color: colors.mutedForeground,
          textAlign: "center",
        }}
      >
        {day.dateLabel}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontFamily: "Outfit_600SemiBold",
          color: day.color,
          textAlign: "center",
        }}
      >
        {day.ratingLabel}
      </Text>
    </Pressable>
  );
}

// ── Condition row ─────────────────────────────────────────────────────────────

function ConditionRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: string;
  label: string;
  value: string;
  ok: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon as any} size={15} color={colors.mutedForeground} />
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: colors.mutedForeground,
          width: 90,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.foreground,
        }}
      >
        {value}
      </Text>
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle-outline"}
        size={14}
        color={ok ? "#2D7A3A" : "#C07820"}
      />
    </View>
  );
}

// ── Inversion warning ─────────────────────────────────────────────────────────

function InversionBanner() {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
        backgroundColor: "#F59E0B18",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#F59E0B35",
        padding: 10,
      }}
    >
      <Ionicons
        name="warning-outline"
        size={16}
        color="#B45309"
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: "#B45309" }}
        >
          Temperature Inversion Risk
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: "#B45309",
            lineHeight: 16,
          }}
        >
          Calm winds can trap a cold air layer near the surface. Spray droplets
          drift unpredictably and may move far off-target. Wait until wind
          reaches 3+ mph before applying.
        </Text>
      </View>
    </View>
  );
}

// ── Hourly sparkline ──────────────────────────────────────────────────────────

function HourlySparkline({ slots }: { slots: HourlySlot[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
    >
      {slots.map((slot) => (
        <View
          key={slot.hour}
          style={{ alignItems: "center", gap: 3, width: 38 }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: slot.color + "25",
              borderWidth: 2,
              borderColor: slot.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RatingIcon rating={slot.rating} color={slot.color} size={12} />
          </View>
          <Text
            style={{
              fontSize: 9,
              fontFamily: "Outfit_600SemiBold",
              color: slot.color,
              textAlign: "center",
            }}
          >
            {slot.label}
          </Text>
          {slot.note && (
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Outfit_400Regular",
                color: "#6B7280",
                textAlign: "center",
                lineHeight: 10,
              }}
              numberOfLines={2}
            >
              {slot.note}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Best window callout ───────────────────────────────────────────────────────

function BestWindowCallout({
  slots,
  colors,
}: {
  slots: HourlySlot[];
  colors: ReturnType<typeof useColors>;
}) {
  if (!slots.length) return null;
  const start = slots[0].label;
  const end   = slots[slots.length - 1].label;
  const timeRange = start === end ? start : `${start} – ${end}`;
  const hasIdeal  = slots.some((s) => s.rating === "ideal");
  const color     = hasIdeal ? RATING_COLORS.ideal : RATING_COLORS.good;
  const avgWind   = Math.round(slots.reduce((s, sl) => s + sl.windSpeed,    0) / slots.length);
  const avgRH     = Math.round(slots.reduce((s, sl) => s + sl.humidity,     0) / slots.length);
  const avgTemp   = Math.round(slots.reduce((s, sl) => s + sl.temperature,  0) / slots.length);

  return (
    <View
      style={{
        backgroundColor: color + "12",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: color + "35",
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="time-outline" size={16} color={color} />
        <Text
          style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color }}
        >
          Best window: {timeRange}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 20 }}>
        {[
          { value: `${avgWind}`, unit: "mph wind" },
          { value: `${avgTemp}°`, unit: "temp °F" },
          { value: `${avgRH}%`, unit: "humidity" },
        ].map(({ value, unit }) => (
          <View key={unit} style={{ alignItems: "center", gap: 2 }}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.foreground,
              }}
            >
              {value}
            </Text>
            <Text
              style={{
                fontSize: 9,
                fontFamily: "Outfit_500Medium",
                color: colors.mutedForeground,
              }}
            >
              {unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Hourly panel (fetches its own data) ───────────────────────────────────────

function HourlyPanel({
  day,
  lat,
  lng,
  sprayType,
  colors,
}: {
  day: SprayDayResult;
  lat: number;
  lng: number;
  sprayType: SprayType;
  colors: ReturnType<typeof useColors>;
}) {
  const { data: hourly, isLoading, isError, error } = useGetHourlyForecast(
    { lat, lng },
    { query: { queryKey: ["hourlyForecast", lat, lng], retry: false, staleTime: 10 * 60 * 1000 } }
  );

  // 403 = free tier — silently hide
  if (isError && (error as any)?.status === 403) return null;
  if (isLoading) {
    return (
      <View style={{ paddingTop: 4, gap: 8 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Hourly windows
        </Text>
        <ActivityIndicator size="small" color="#366441" />
      </View>
    );
  }
  if (!hourly?.length) return null;

  const slots = computeHourlySlots(hourly, day.date, sprayType);
  if (!slots.length) return null;

  const bestWindow = findBestHourlyWindow(slots);

  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Outfit_600SemiBold",
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        Hourly windows — {day.dateLabel}
      </Text>
      {bestWindow.length > 0 && (
        <BestWindowCallout slots={bestWindow} colors={colors} />
      )}
      <HourlySparkline slots={slots} />
    </View>
  );
}

// ── Day detail panel ──────────────────────────────────────────────────────────

function DayDetailPanel({
  day,
  sprayType,
  lat,
  lng,
}: {
  day: SprayDayResult;
  sprayType: SprayType;
  lat?: number | null;
  lng?: number | null;
}) {
  const colors    = useColors();
  const typeInfo  = getSprayTypeInfo(sprayType);
  const [hMin, hMax] = typeInfo.humidityIdeal;

  return (
    <View
      style={{
        backgroundColor: day.color + "0E",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: day.color + "35",
        padding: 14,
        gap: 12,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_700Bold",
            color: colors.foreground,
          }}
        >
          {day.dayLabel} · {day.dateLabel}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: day.color + "22",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <RatingIcon rating={day.rating} color={day.color} size={12} />
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_600SemiBold",
              color: day.color,
            }}
          >
            {day.ratingLabel}
          </Text>
        </View>
      </View>

      {/* Inversion warning */}
      {day.inversionRisk && <InversionBanner />}

      {/* Conditions */}
      <View style={{ gap: 8 }}>
        <ConditionRow
          icon="partly-sunny-outline"
          label="Temperature"
          value={`${day.tempMin}–${day.tempMax}°F`}
          ok={day.tempMax <= 90 && day.tempMin > 32}
        />
        <ConditionRow
          icon="flag-outline"
          label="Wind speed"
          value={`${day.wind} mph max`}
          ok={day.wind >= 2 && day.wind <= 15}
        />
        <ConditionRow
          icon="rainy-outline"
          label="Rain chance"
          value={`${day.precipProbability}% · ${day.precipInches}" expected`}
          ok={day.precipProbability < 40 && day.precipInches < 0.1}
        />
        {day.humidity != null && (
          <ConditionRow
            icon="water-outline"
            label="Humidity"
            value={`${day.humidity}% avg (ideal ${hMin}–${hMax}%)`}
            ok={day.humidity >= hMin && day.humidity <= hMax}
          />
        )}
      </View>

      {/* Summary sentence */}
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_400Regular",
          color: colors.mutedForeground,
          lineHeight: 17,
        }}
      >
        {day.summary}
      </Text>

      {/* Hourly breakdown (paid tier only; silently hidden for free users) */}
      {lat != null && lng != null && (
        <View style={{ height: 1, backgroundColor: day.color + "25" }} />
      )}
      {lat != null && lng != null && (
        <HourlyPanel
          day={day}
          lat={lat}
          lng={lng}
          sprayType={sprayType}
          colors={colors}
        />
      )}
    </View>
  );
}

// ── Legend row ────────────────────────────────────────────────────────────────

const LEGEND: { rating: SprayRating; label: string; color: string }[] = [
  { rating: "ideal",    label: "Ideal",    color: "#2D7A3A" },
  { rating: "good",     label: "Good",     color: "#4D8A5E" },
  { rating: "marginal", label: "Marginal", color: "#C07820" },
  { rating: "poor",     label: "Poor",     color: "#D05820" },
  { rating: "avoid",    label: "Avoid",    color: "#D03020" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function SprayWindowCard({ insights, lat, lng }: Props) {
  const colors    = useColors();
  const hasCoords = lat != null && lng != null;

  const [sprayType, setSprayType] = useState<SprayType>("herbicide");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // Prefetch hourly data to derive daily humidity averages
  const { data: hourly } = useGetHourlyForecast(
    { lat: lat ?? 0, lng: lng ?? 0 },
    { query: { queryKey: ["hourlyForecast", lat, lng], enabled: hasCoords, retry: false, staleTime: 10 * 60 * 1000 } }
  );

  const result = computeSprayWindows(
    insights.windDaily,
    insights.temperatureDaily,
    insights.precipitationDaily,
    hourly ?? undefined,
    sprayType,
  );

  const typeInfo   = getSprayTypeInfo(sprayType);
  const safeIdx    = Math.min(selectedIdx, Math.max(0, result.days.length - 1));
  const selectedDay = result.days[safeIdx];
  const badgeColor =
    result.goodWindowCount >= 3
      ? "#2D7A3A"
      : result.goodWindowCount > 0
      ? "#C07820"
      : "#D03020";

  if (result.days.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={32}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_500Medium",
            color: colors.mutedForeground,
            textAlign: "center",
          }}
        >
          Forecast data not yet available for spray window analysis.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* ── Summary header ─────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: badgeColor + "18",
            borderWidth: 4,
            borderColor: badgeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color: badgeColor,
              lineHeight: 26,
            }}
          >
            {result.goodWindowCount}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Outfit_700Bold",
              color: colors.foreground,
              lineHeight: 20,
            }}
          >
            {result.goodWindowCount === 1
              ? "1 spray window this week"
              : `${result.goodWindowCount} spray windows this week`}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
              lineHeight: 17,
              marginTop: 3,
            }}
          >
            {result.weekSummary}
          </Text>
        </View>
      </View>

      {/* ── Application type selector ────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ paddingVertical: 12 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            paddingHorizontal: 16,
            marginBottom: 8,
          }}
        >
          Application type
        </Text>
        <SprayTypeSelector
          selected={sprayType}
          onChange={(t) => {
            setSprayType(t);
            setSelectedIdx(result.nextGoodWindowIndex ?? 0);
          }}
          colors={colors}
        />
      </View>

      {/* ── Agronomic tip ─────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-start",
          marginHorizontal: 16,
          marginBottom: 12,
          backgroundColor: "#366441" + "0D",
          borderRadius: 10,
          padding: 10,
        }}
      >
        <Ionicons name="bulb-outline" size={14} color="#366441" style={{ marginTop: 1 }} />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: "#366441",
            lineHeight: 16,
          }}
        >
          <Text style={{ fontFamily: "Outfit_600SemiBold" }}>
            {typeInfo.label}:{" "}
          </Text>
          {typeInfo.tip}
          {typeInfo.rainFreeHours > 0
            ? ` Rain-free interval: ${typeInfo.rainFreeHours}+ hours.`
            : ""}
        </Text>
      </View>

      {/* ── 7-day tile row ─────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ paddingTop: 14, paddingBottom: 4 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            paddingHorizontal: 16,
            marginBottom: 10,
          }}
        >
          Tap a day for details
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {result.days.map((day, idx) => (
            <DayTile
              key={day.date}
              day={day}
              selected={idx === safeIdx}
              onPress={() => setSelectedIdx(idx)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Selected day detail ───────────────────────────────────────────── */}
      <View style={{ padding: 16, paddingTop: 12 }}>
        <DayDetailPanel
          day={selectedDay}
          sprayType={sprayType}
          lat={lat}
          lng={lng}
        />
      </View>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {LEGEND.map((l) => (
          <View
            key={l.rating}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <RatingIcon rating={l.rating} color={l.color} size={12} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
              }}
            >
              {l.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={12}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            fontStyle: "italic",
            flex: 1,
          }}
        >
          Based on wind speed, temperature, humidity, and precipitation.
          Always follow product label requirements.
        </Text>
      </View>
    </View>
  );
}
