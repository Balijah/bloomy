/**
 * IrrigationCard — irrigation scheduling assistant on the farm detail screen.
 *
 * Shows current soil water status, days until next irrigation, recommended
 * application depth, and a 7-day net water balance chart.
 * All data comes from the already-loaded AgricultureInsights — no extra calls.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  computeIrrigation,
  type IrrigationDayBalance,
  type IrrigationResult,
  type DailyPrecipEntry,
} from "@/lib/irrigation";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
  cropType: string;
}

// ── Soil water gauge bar ──────────────────────────────────────────────────────

function SoilWaterGauge({
  pct,
  madPct,
  color,
}: {
  pct: number;
  madPct: number;
  color: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const fillWidth = width > 0 ? width * (pct / 100) : 0;
  const triggerX = width > 0 ? width * ((100 - madPct) / 100) : 0;

  return (
    <View style={{ gap: 6 }}>
      {/* Bar track */}
      <View
        style={{
          height: 14,
          backgroundColor: colors.muted,
          borderRadius: 8,
          overflow: "visible",
          position: "relative",
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <>
            {/* Fill */}
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: Math.max(fillWidth, 6),
                backgroundColor: color,
                borderRadius: 8,
              }}
            />
            {/* MAD trigger line */}
            <View
              style={{
                position: "absolute",
                left: triggerX - 1,
                top: -3,
                bottom: -3,
                width: 2,
                backgroundColor: "#D05820",
                borderRadius: 1,
              }}
            />
          </>
        )}
      </View>

      {/* Labels row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          Wilting point
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color,
          }}
        >
          {pct}% available
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          Field capacity
        </Text>
      </View>

      {/* Trigger annotation */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View
          style={{
            width: 10,
            height: 2,
            backgroundColor: "#D05820",
            borderRadius: 1,
          }}
        />
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          Irrigation trigger at {100 - madPct}% available water
        </Text>
      </View>
    </View>
  );
}

// ── 7-day net balance chart ───────────────────────────────────────────────────

function NetBalanceChart({ days }: { days: IrrigationDayBalance[] }) {
  const colors = useColors();
  const [chartWidth, setChartWidth] = useState(0);

  if (days.length === 0) return null;

  // Find max net depletion for scale
  const maxVal = Math.max(0.05, ...days.map((d) => Math.max(d.et, d.rain)));
  const barAreaHeight = 60;
  const barWidth = chartWidth > 0 ? (chartWidth - (days.length - 1) * 6) / days.length : 32;

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Outfit_600SemiBold",
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        7-Day Water Balance
      </Text>

      {/* Legend */}
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#D05820",
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
            }}
          >
            ET demand
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#2860A8",
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
            }}
          >
            Rainfall
          </Text>
        </View>
      </View>

      {/* Chart area */}
      <View
        style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: barAreaHeight + 24 }}
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      >
        {days.map((day, i) => {
          const etH = Math.round((day.et / maxVal) * barAreaHeight);
          const rainH = Math.round((day.rain / maxVal) * barAreaHeight);
          const isGain = day.rain >= day.et;

          return (
            <View
              key={day.date}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 4,
              }}
            >
              {/* Paired bars side by side */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  height: barAreaHeight,
                  gap: 2,
                }}
              >
                {/* ET bar */}
                <View
                  style={{
                    flex: 1,
                    height: Math.max(etH, 3),
                    backgroundColor: "#D05820",
                    borderRadius: 3,
                    opacity: isGain ? 0.4 : 0.9,
                  }}
                />
                {/* Rain bar */}
                <View
                  style={{
                    flex: 1,
                    height: Math.max(rainH, day.rain > 0 ? 3 : 0),
                    backgroundColor: "#2860A8",
                    borderRadius: 3,
                    opacity: 0.85,
                  }}
                />
              </View>

              {/* Day label */}
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_500Medium",
                  color: colors.mutedForeground,
                  textAlign: "center",
                }}
              >
                {day.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon as any} size={17} color={colors.mutedForeground} />
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
            fontSize: 15,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            lineHeight: 20,
          }}
        >
          {value}
        </Text>
        {sub && (
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
              lineHeight: 14,
            }}
          >
            {sub}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Flooded note (rice) ───────────────────────────────────────────────────────

function FloodedNote({ result }: { result: IrrigationResult }) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: "#2860A812",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2860A830",
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="water" size={18} color="#2860A8" />
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_700Bold",
            color: "#2860A8",
          }}
        >
          Flood Irrigation
        </Text>
      </View>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Outfit_400Regular",
          color: colors.foreground,
          lineHeight: 19,
        }}
      >
        {result.message}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
        <Ionicons
          name="bulb-outline"
          size={13}
          color="#2860A8"
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
  );
}

// ── Friendly date helper ──────────────────────────────────────────────────────

function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IrrigationCard({ insights, cropType }: Props) {
  const colors = useColors();

  // Distribute the 7-day precipitation forecast evenly across days
  const today = new Date();
  const dailyRainIn = (insights.precipitationForecast ?? 0) / 7;
  const precipitationDaily: DailyPrecipEntry[] = Array.from(
    { length: 7 },
    (_, i) => {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i
      );
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        precipitation: dailyRainIn,
      };
    }
  );

  const result = computeIrrigation({
    soilMoisture: insights.soilMoisture,
    evapotranspiration7Day: insights.evapotranspiration7Day,
    precipitationDeficit: insights.precipitationDeficit,
    precipitationDaily,
    droughtRiskLevel: insights.droughtRisk?.level,
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
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 16,
        }}
      >
        {/* Status badge */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 4,
            borderColor: result.statusColor,
            backgroundColor: result.statusColor + "14",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {result.daysUntilIrrigation === 0 || result.status === "irrigate_now" ? (
            <Ionicons name="water" size={24} color={result.statusColor} />
          ) : result.daysUntilIrrigation != null ? (
            <>
              <Text
                style={{
                  fontSize: result.daysUntilIrrigation >= 10 ? 16 : 20,
                  fontFamily: "Outfit_700Bold",
                  color: result.statusColor,
                  lineHeight: result.daysUntilIrrigation >= 10 ? 19 : 24,
                }}
              >
                {result.daysUntilIrrigation}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: "Outfit_500Medium",
                  color: colors.mutedForeground,
                  lineHeight: 10,
                }}
              >
                days
              </Text>
            </>
          ) : (
            <Ionicons name="checkmark-circle" size={24} color={result.statusColor} />
          )}
        </View>

        {/* Title + status */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Outfit_700Bold",
              color: result.statusColor,
              lineHeight: 22,
            }}
          >
            {result.statusLabel}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
              lineHeight: 17,
            }}
          >
            {result.flooded
              ? "Flood-irrigated crop — maintain standing water"
              : result.status === "sufficient" || result.status === "adequate"
              ? "No irrigation needed this week"
              : result.daysUntilIrrigation === 0
              ? "Irrigate today — soil water below trigger"
              : `Irrigation recommended in ${result.daysUntilIrrigation} day${result.daysUntilIrrigation !== 1 ? "s" : ""}`}
          </Text>
          {/* Sensor badge */}
          {!result.flooded && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                alignSelf: "flex-start",
                backgroundColor: result.sensorBased
                  ? colors.primary + "20"
                  : colors.muted,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Ionicons
                name={result.sensorBased ? "radio-outline" : "analytics-outline"}
                size={10}
                color={result.sensorBased ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_600SemiBold",
                  color: result.sensorBased ? colors.primary : colors.mutedForeground,
                }}
              >
                {result.sensorBased ? "Live sensor" : "Estimated"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 18 }}>
        {result.flooded ? (
          <FloodedNote result={result} />
        ) : (
          <>
            {/* Soil water gauge */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Root Zone Soil Water
              </Text>
              <SoilWaterGauge
                pct={result.currentAwPct}
                madPct={result.madPct}
                color={result.statusColor}
              />
            </View>

            {/* Key stats */}
            <View style={{ gap: 12 }}>
              {result.nextIrrigationDate && (
                <StatRow
                  icon="calendar-outline"
                  label="Next irrigation"
                  value={
                    result.daysUntilIrrigation === 0
                      ? "Today"
                      : `${friendlyDate(result.nextIrrigationDate)} (in ${result.daysUntilIrrigation} day${result.daysUntilIrrigation !== 1 ? "s" : ""})`
                  }
                />
              )}
              {result.recommendedDepthIn > 0 && (
                <StatRow
                  icon="water-outline"
                  label="Recommended depth"
                  value={`${result.recommendedDepthIn}"`}
                  sub={`Fills root zone to field capacity (${result.awcTotal}" total AWC)`}
                />
              )}
              <StatRow
                icon="resize-outline"
                label="Effective root zone"
                value={`${result.rootDepthIn}" depth`}
                sub={`MAD trigger: ${result.madPct}% depletion allowed`}
              />
            </View>

            {/* Situation summary */}
            <View
              style={{
                backgroundColor: result.statusColor + "0E",
                borderRadius: 12,
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
                  size={13}
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

            {/* 7-day net balance chart */}
            {result.dailyBalance.length > 0 && (
              <NetBalanceChart days={result.dailyBalance} />
            )}
          </>
        )}
      </View>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={12}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            fontStyle: "italic",
          }}
        >
          FAO-56 simplified water balance · Generic loam soil (FC 35%, WP 10%) · Verify with tensiometer readings.
        </Text>
      </View>
    </View>
  );
}
