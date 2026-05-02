/**
 * SoilHealthCard — detailed soil health breakdown on the farm detail screen.
 * Scores are computed client-side from insight fields already in the response.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  computeSoilHealth,
  soilTrendIcon,
  type SoilHealthFactor,
  type SoilHealthResult,
} from "@/lib/soilHealth";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const colors = useColors();
  // Rendered as a bold circular number + arc using a simple ring pattern
  return (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 6,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color + "12",
      }}
    >
      <Text
        style={{
          fontSize: 26,
          fontFamily: "Outfit_700Bold",
          color,
          lineHeight: 30,
        }}
      >
        {score}
      </Text>
      <Text
        style={{
          fontSize: 9,
          fontFamily: "Outfit_500Medium",
          color: colors.mutedForeground,
          lineHeight: 11,
        }}
      >
        / 100
      </Text>
    </View>
  );
}

function FactorBar({
  factor,
  color,
}: {
  factor: SoilHealthFactor;
  color: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const fillWidth = width > 0 ? width * (factor.score / 100) : 0;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_600SemiBold",
              color: colors.foreground,
            }}
          >
            {factor.name}
          </Text>
          {factor.measured && (
            <View
              style={{
                backgroundColor: colors.primary + "20",
                borderRadius: 999,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.primary,
                  letterSpacing: 0.3,
                }}
              >
                LIVE
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_600SemiBold",
            color,
          }}
        >
          {factor.label}
        </Text>
      </View>

      {/* Track */}
      <View
        style={{
          height: 7,
          backgroundColor: colors.muted,
          borderRadius: 4,
          overflow: "hidden",
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <View
            style={{
              width: Math.max(fillWidth, 4),
              height: "100%",
              backgroundColor: color,
              borderRadius: 4,
            }}
          />
        )}
      </View>

      <Text
        style={{
          fontSize: 11,
          fontFamily: "Outfit_400Regular",
          color: colors.mutedForeground,
          lineHeight: 15,
        }}
      >
        {factor.description}
      </Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function factorColor(score: number): string {
  if (score >= 80) return "#2D7A3A";
  if (score >= 60) return "#4D8A5E";
  if (score >= 40) return "#C07820";
  if (score >= 20) return "#D05820";
  return "#D03020";
}

function recommendationFor(result: SoilHealthResult): string {
  if (result.score >= 80) {
    return "Soil moisture conditions are excellent — maintain your current irrigation schedule.";
  }
  if (result.score >= 60) {
    return "Conditions are adequate. Monitor soil moisture weekly and irrigate if the next 7-day outlook stays dry.";
  }
  if (result.score >= 40) {
    return "Moderate moisture stress detected. Consider scheduling irrigation and checking soil at 6\" depth.";
  }
  if (result.score >= 20) {
    return "Significant moisture deficit. Irrigate promptly and avoid tillage operations that accelerate moisture loss.";
  }
  return "Critical moisture stress — prioritise irrigation immediately to prevent irreversible yield loss.";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SoilHealthCard({ insights }: Props) {
  const colors = useColors();

  const result = computeSoilHealth({
    soilMoisture: insights.soilMoisture,
    evapotranspiration7Day: insights.evapotranspiration7Day,
    precipitationDeficit: insights.precipitationDeficit ?? 0,
    precipitationForecast: insights.precipitationForecast ?? 0,
    droughtRiskLevel: insights.droughtRisk?.level ?? "none",
  });

  const trendIcon = soilTrendIcon(result.trend);

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
      {/* ── Score header ─────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          padding: 16,
        }}
      >
        <ScoreRing score={result.score} color={result.color} />

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_700Bold",
              color: result.color,
              lineHeight: 26,
            }}
          >
            {result.label}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
              lineHeight: 18,
            }}
          >
            {recommendationFor(result)}
          </Text>
        </View>
      </View>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── Factor breakdown ─────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 16 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Contributing Factors
        </Text>

        {result.factors.map((factor) => (
          <FactorBar
            key={factor.key}
            factor={factor}
            color={factorColor(factor.score)}
          />
        ))}
      </View>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
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
          Derived from Open-Meteo soil and precipitation data for this location.
        </Text>
      </View>
    </View>
  );
}
