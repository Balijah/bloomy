/**
 * FrostCountdownCard — shows days until next frost alongside a harvest-overlap
 * analysis on the farm detail screen.
 *
 * All data comes from the already-loaded AgricultureInsights — no extra calls.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  computeFrostRisk,
  formatFrostDate,
  frostStatusIcon,
  type FrostStatus,
} from "@/lib/frostRisk";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
  cropType: string;
}

// ── Countdown display ─────────────────────────────────────────────────────────

function CountdownRing({
  days,
  color,
}: {
  days: number;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 5,
        borderColor: color,
        backgroundColor: color + "14",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: days >= 100 ? 20 : 26,
          fontFamily: "Outfit_700Bold",
          color,
          lineHeight: days >= 100 ? 24 : 30,
        }}
      >
        {days}
      </Text>
      <Text
        style={{
          fontSize: 9,
          fontFamily: "Outfit_500Medium",
          color: colors.mutedForeground,
          lineHeight: 11,
        }}
      >
        days
      </Text>
    </View>
  );
}

function NoFrostRing({ color }: { color: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 5,
        borderColor: color,
        backgroundColor: color + "14",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="sunny" size={28} color={color} />
    </View>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({
  status,
  label,
  color,
}: {
  status: FrostStatus;
  label: string;
  color: string;
}) {
  const icon = frostStatusIcon(status);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        backgroundColor: color + "18",
        borderWidth: 1,
        borderColor: color + "45",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Ionicons name={icon as any} size={13} color={color} />
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon as any} size={15} color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            lineHeight: 14,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            lineHeight: 18,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FrostCountdownCard({ insights, cropType }: Props) {
  const colors = useColors();

  const result = computeFrostRisk({
    nextFrostDate: insights.nextFrostDate,
    accumulatedGDD: insights.accumulatedGDD,
    growingDegreeDaysForecast: insights.growingDegreeDaysForecast,
    cropType,
  });

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
      {/* ── Header row ───────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          padding: 16,
        }}
      >
        {/* Countdown ring */}
        {result.daysToFrost != null ? (
          <CountdownRing
            days={result.daysToFrost}
            color={result.statusColor}
          />
        ) : (
          <NoFrostRing color={result.statusColor} />
        )}

        {/* Right side */}
        <View style={{ flex: 1, gap: 6 }}>
          {/* Frost date or "none" */}
          <Text
            style={{
              fontSize: 19,
              fontFamily: "Outfit_700Bold",
              color: colors.foreground,
              lineHeight: 23,
            }}
          >
            {result.frostDate
              ? formatFrostDate(result.frostDate)
              : "No frost in outlook"}
          </Text>

          {result.frostDate && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
                lineHeight: 16,
              }}
            >
              First frost expected
            </Text>
          )}

          <StatusPill
            status={result.status}
            label={result.statusLabel}
            color={result.statusColor}
          />
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── Detail rows ──────────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 14 }}>
        {/* Harvest estimate */}
        {result.harvestDaysEstimate != null && (
          <DetailRow
            icon="leaf-outline"
            label="Estimated days to harvest"
            value={
              result.harvestDaysEstimate === 0
                ? "Ready now"
                : `~${result.harvestDaysEstimate} days${result.gddToHarvest != null && result.gddToHarvest > 0 ? ` (${result.gddToHarvest} GDD remaining)` : ""}`
            }
          />
        )}

        {/* Frost threshold note */}
        <DetailRow
          icon="thermometer-outline"
          label="Frost threshold"
          value="32°F (0°C) — killing frost for most crops"
        />

        {/* Situation summary */}
        <View
          style={{
            backgroundColor: result.statusColor + "10",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: result.statusColor + "30",
            padding: 12,
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_500Medium",
              color: colors.foreground,
              lineHeight: 19,
            }}
          >
            {result.message}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Ionicons
              name="bulb-outline"
              size={14}
              color={result.statusColor}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
                lineHeight: 17,
              }}
            >
              {result.action}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
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
          }}
        >
          Harvest estimate uses GDD accumulation rate from the 15-day forecast.
        </Text>
      </View>
    </View>
  );
}
