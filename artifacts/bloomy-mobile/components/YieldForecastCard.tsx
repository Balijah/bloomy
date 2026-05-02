/**
 * YieldForecastCard — displays an estimated yield range for the season based
 * on crop baselines, accumulated GDD stage progress, and weather stress factors
 * already present in the agriculture insights response.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { getCurrentStage, getStagesForCrop } from "@/lib/cropStages";
import {
  computeYieldForecast,
  type ConfidenceLevel,
  type RiskLevel,
  type StressItem,
} from "@/lib/yieldForecast";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceBadgeColor(level: ConfidenceLevel, primary: string, muted: string) {
  if (level === "high") return primary;
  if (level === "moderate") return "#D08A20";
  return muted;
}

function confidenceBadgeBg(level: ConfidenceLevel, primary: string) {
  if (level === "high") return primary + "18";
  if (level === "moderate") return "#D08A2018";
  return "#00000010";
}

function penaltyLabel(penalty: number): string {
  if (penalty <= 0) return "—";
  return `-${Math.round(penalty * 100)}%`;
}

function stressIconName(level: RiskLevel): "checkmark-circle" | "warning" | "alert-circle" {
  if (level === "none") return "checkmark-circle";
  if (level === "critical" || level === "high") return "alert-circle";
  return "warning";
}

function stressIconColor(level: RiskLevel, primary: string): string {
  if (level === "none") return primary;
  if (level === "critical") return "#F23030";
  if (level === "high") return "#F07030";
  return "#D08A20";
}

// ── Range bar ─────────────────────────────────────────────────────────────────

function RangeBar({
  profileLow,
  profileHigh,
  estimatedLow,
  estimatedHigh,
}: {
  profileLow: number;
  profileHigh: number;
  estimatedLow: number;
  estimatedHigh: number;
}) {
  const colors = useColors();
  const [barWidth, setBarWidth] = useState(0);

  const span = profileHigh - profileLow || 1;
  const lowFrac = Math.max(0, (estimatedLow - profileLow) / span);
  const highFrac = Math.min(1, (estimatedHigh - profileLow) / span);

  const leftPx = barWidth * lowFrac;
  const widthPx = barWidth * (highFrac - lowFrac);

  return (
    <View style={{ gap: 6 }}>
      {/* Track */}
      <View
        style={{
          height: 10,
          backgroundColor: colors.muted,
          borderRadius: 5,
          overflow: "hidden",
        }}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Highlighted range — only render once we have width */}
        {barWidth > 0 && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: leftPx,
              width: Math.max(widthPx, 6),
              backgroundColor: colors.primary,
              borderRadius: 5,
            }}
          />
        )}
      </View>

      {/* Axis labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          {profileLow} (low)
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          {profileHigh} (high)
        </Text>
      </View>
    </View>
  );
}

// ── Stress row ────────────────────────────────────────────────────────────────

function StressRow({ item }: { item: StressItem }) {
  const colors = useColors();
  const iconName = stressIconName(item.level);
  const iconColor = stressIconColor(item.level, colors.primary);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Ionicons
        name={iconName}
        size={16}
        color={iconColor}
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
          }}
        >
          {item.label}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            lineHeight: 17,
            marginTop: 1,
          }}
        >
          {item.sublabel}
        </Text>
      </View>
      {item.penalty > 0 && (
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_600SemiBold",
            color: "#F07030",
            marginTop: 2,
          }}
        >
          {penaltyLabel(item.penalty)}
        </Text>
      )}
    </View>
  );
}

// ── Empty state (no planting date) ────────────────────────────────────────────

function EmptyState({ cropType }: { cropType: string }) {
  const colors = useColors();
  const stages = getStagesForCrop(cropType);

  // Even without a planting date we can show the potential range
  const dummyResult = computeYieldForecast({
    cropType,
    currentStageIndex: 0,
    totalStages: stages.length,
    frostRiskLevel: "none",
    heatStressRiskLevel: "none",
    droughtRiskLevel: "none",
    harvestDisruptionRiskLevel: "none",
    precipitationDeficit: 0,
    criticalEventCount: 0,
  });

  const { profile } = dummyResult;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
        alignItems: "center",
      }}
    >
      <Ionicons name="stats-chart-outline" size={28} color={colors.mutedForeground} />
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            textAlign: "center",
          }}
        >
          Set a planting date to see your yield forecast
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          Typical potential range for this crop:{" "}
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color: colors.foreground,
            }}
          >
            {profile.low}–{profile.high} {profile.unit}
          </Text>
        </Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function YieldForecastCard({ insights }: Props) {
  const colors = useColors();
  const {
    cropType,
    accumulatedGDD,
    frostRisk,
    heatStressRisk,
    droughtRisk,
    harvestDisruptionRisk,
    precipitationDeficit,
    extremeEventsNext15Days,
  } = insights;

  if (accumulatedGDD == null) {
    return <EmptyState cropType={cropType} />;
  }

  const stageResult = getCurrentStage(cropType, accumulatedGDD);
  const criticalEventCount = (extremeEventsNext15Days ?? []).filter(
    (e) => e.severity === "critical"
  ).length;

  const forecast = computeYieldForecast({
    cropType,
    currentStageIndex: stageResult.currentIndex,
    totalStages: stageResult.stages.length,
    frostRiskLevel: (frostRisk?.level ?? "none") as RiskLevel,
    heatStressRiskLevel: (heatStressRisk?.level ?? "none") as RiskLevel,
    droughtRiskLevel: (droughtRisk?.level ?? "none") as RiskLevel,
    harvestDisruptionRiskLevel: (harvestDisruptionRisk?.level ?? "none") as RiskLevel,
    precipitationDeficit: precipitationDeficit ?? 0,
    criticalEventCount,
  });

  const {
    profile,
    estimatedLow,
    estimatedHigh,
    totalStressPenalty,
    stressItems,
    confidence,
    confidenceLabel,
    earlyEstimate,
  } = forecast;

  const badgeColor = confidenceBadgeColor(confidence, colors.primary, colors.mutedForeground);
  const badgeBg = confidenceBadgeBg(confidence, colors.primary);

  // All-clear: no stress items detected
  const allClear = stressItems.length === 0;

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
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.primary + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="stats-chart" size={15} color={colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Outfit_600SemiBold",
              color: colors.foreground,
            }}
          >
            Yield Forecast
          </Text>
        </View>

        {/* Confidence badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: badgeBg,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: badgeColor,
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_600SemiBold",
              color: badgeColor,
            }}
          >
            {confidence === "high"
              ? "Higher confidence"
              : confidence === "moderate"
              ? "Moderate confidence"
              : "Early estimate"}
          </Text>
        </View>
      </View>

      {/* ── Big yield number ──────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 14,
          alignItems: "flex-start",
          gap: 2,
        }}
      >
        <Text
          style={{
            fontSize: 38,
            fontFamily: "Outfit_700Bold",
            color: colors.foreground,
            lineHeight: 44,
          }}
        >
          {estimatedLow}
          <Text style={{ color: colors.mutedForeground }}>
            {" "}–{" "}
          </Text>
          {estimatedHigh}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Outfit_500Medium",
            color: colors.mutedForeground,
          }}
        >
          {profile.unit}
          {totalStressPenalty > 0 && (
            <Text style={{ color: "#F07030" }}>
              {"  "}↓ {Math.round(totalStressPenalty * 100)}% season stress reduction
            </Text>
          )}
        </Text>
      </View>

      {/* ── Range bar ─────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <RangeBar
          profileLow={profile.low}
          profileHigh={profile.high}
          estimatedLow={estimatedLow}
          estimatedHigh={estimatedHigh}
        />
      </View>

      {/* ── Confidence label ──────────────────────────────────────────────── */}
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={colors.mutedForeground}
        />
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            fontStyle: "italic",
          }}
        >
          {confidenceLabel}
        </Text>
      </View>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── Season conditions ────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 12 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Season Conditions
        </Text>

        {allClear ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.primary + "12",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.primary}
            />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Outfit_500Medium",
                color: colors.primary,
                flex: 1,
              }}
            >
              No stress factors detected — conditions look favorable
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {stressItems.map((item, i) => (
              <StressRow key={i} item={item} />
            ))}
          </View>
        )}

        {earlyEstimate && (
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
              fontStyle: "italic",
              lineHeight: 16,
            }}
          >
            Estimates improve as the season progresses and more GDD data accumulates.
          </Text>
        )}
      </View>
    </View>
  );
}
