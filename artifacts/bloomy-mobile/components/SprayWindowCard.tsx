/**
 * SprayWindowCard — 7-day spray window forecast on the farm detail screen.
 *
 * Rates each day's suitability for pesticide / herbicide / foliar application
 * based on wind speed, temperature, and precipitation probability.
 * All data comes from the already-loaded AgricultureInsights — no extra calls.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  computeSprayWindows,
  type SprayDayResult,
  type SprayRating,
} from "@/lib/sprayWindow";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND: { rating: SprayRating; label: string; color: string }[] = [
  { rating: "ideal",    label: "Ideal",    color: "#2D7A3A" },
  { rating: "good",     label: "Good",     color: "#4D8A5E" },
  { rating: "marginal", label: "Marginal", color: "#C07820" },
  { rating: "poor",     label: "Poor",     color: "#D05820" },
  { rating: "avoid",    label: "Avoid",    color: "#D03020" },
];

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
      {/* Day name */}
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

      {/* Coloured rating dot */}
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

      {/* Date */}
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

      {/* Rating label */}
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
  return (
    <Ionicons name={iconMap[rating] as any} size={size} color={color} />
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DayDetailPanel({ day }: { day: SprayDayResult }) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: day.color + "0E",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: day.color + "35",
        padding: 14,
        gap: 10,
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

      {/* Condition rows */}
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
      </View>

      {/* Summary */}
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
    </View>
  );
}

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
  const tickColor = ok ? "#2D7A3A" : "#C07820";
  const tickIcon = ok ? "checkmark-circle" : "alert-circle-outline";

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
      <Ionicons name={tickIcon as any} size={14} color={tickColor} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SprayWindowCard({ insights }: Props) {
  const colors = useColors();
  const result = computeSprayWindows(
    insights.windDaily,
    insights.temperatureDaily,
    insights.precipitationDaily,
  );

  const [selectedIdx, setSelectedIdx] = useState<number>(
    result.nextGoodWindowIndex ?? 0
  );

  if (result.days.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={32} color={colors.mutedForeground} />
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

  const selectedDay = result.days[selectedIdx];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* ── Summary header ────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
        }}
      >
        {/* Good-window count badge */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor:
              result.goodWindowCount >= 3
                ? "#2D7A3A18"
                : result.goodWindowCount > 0
                ? "#C0782018"
                : "#D0302018",
            borderWidth: 4,
            borderColor:
              result.goodWindowCount >= 3
                ? "#2D7A3A"
                : result.goodWindowCount > 0
                ? "#C07820"
                : "#D03020",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color:
                result.goodWindowCount >= 3
                  ? "#2D7A3A"
                  : result.goodWindowCount > 0
                  ? "#C07820"
                  : "#D03020",
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

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── 7-day tile row ────────────────────────────────────────────────── */}
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
              selected={idx === selectedIdx}
              onPress={() => setSelectedIdx(idx)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Selected day detail ────────────────────────────────────────────── */}
      <View style={{ padding: 16, paddingTop: 12 }}>
        <DayDetailPanel day={selectedDay} />
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
          Based on wind speed, temperature, and precipitation probability. Always
          follow product label requirements.
        </Text>
      </View>
    </View>
  );
}
