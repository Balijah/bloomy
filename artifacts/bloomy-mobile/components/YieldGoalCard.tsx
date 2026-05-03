/**
 * YieldGoalCard
 *
 * Shows the farmer's self-set yield target versus the weather-adjusted season
 * forecast, plus a total-production estimate and actionable gap analysis.
 *
 * States:
 *   1. No goal set → empty state with CTA to edit farm; still shows forecast
 *   2. Goal set → full tracker with goal vs forecast bar + insights
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AgricultureInsights, FarmProfile } from "@workspace/api-client-react";
import { computeYieldGoal, type GoalStatus } from "@/lib/yieldGoal";
import { useColors } from "@/hooks/useColors";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  profile: FarmProfile;
  insights: AgricultureInsights;
}

// ── Goal vs Forecast Bar ──────────────────────────────────────────────────────

function GoalBar({
  goalValue,
  projectedLow,
  projectedHigh,
  projectedMid,
  unit,
  statusColor,
}: {
  goalValue: number;
  projectedLow: number;
  projectedHigh: number;
  projectedMid: number;
  unit: string;
  statusColor: string;
}) {
  const colors = useColors();
  const [barWidth, setBarWidth] = useState(0);

  // Scale: lowest of (projectedLow * 0.8, goalValue * 0.8) to highest of (projectedHigh * 1.1, goalValue * 1.1)
  const scaleMin = Math.min(projectedLow, goalValue) * 0.85;
  const scaleMax = Math.max(projectedHigh, goalValue) * 1.1;
  const span = scaleMax - scaleMin || 1;

  const toFrac = (v: number) => Math.max(0, Math.min(1, (v - scaleMin) / span));

  const goalFrac = toFrac(goalValue);
  const lowFrac = toFrac(projectedLow);
  const highFrac = toFrac(projectedHigh);

  return (
    <View style={{ gap: 8 }}>
      {/* Track */}
      <View
        style={[gb.track, { backgroundColor: colors.muted }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {barWidth > 0 && (
          <>
            {/* Forecast range fill */}
            <View
              style={[
                gb.rangeFill,
                {
                  left: barWidth * lowFrac,
                  width: Math.max(6, barWidth * (highFrac - lowFrac)),
                  backgroundColor: statusColor + "55",
                  borderColor: statusColor,
                },
              ]}
            />
            {/* Goal line */}
            <View
              style={[
                gb.goalLine,
                { left: barWidth * goalFrac - 1 },
              ]}
            />
            {/* Goal triangle marker */}
            <View style={[gb.goalMarker, { left: barWidth * goalFrac - 6 }]}>
              <Text style={[gb.goalMarkerText, { color: colors.foreground }]}>▼</Text>
            </View>
          </>
        )}
      </View>

      {/* Labels row */}
      <View style={gb.labelsRow}>
        <View style={gb.labelGroup}>
          <View style={[gb.dot, { backgroundColor: statusColor }]} />
          <Text style={[gb.labelText, { color: colors.mutedForeground }]}>
            Forecast: {projectedLow}–{projectedHigh} {unit}
          </Text>
        </View>
        <View style={gb.labelGroup}>
          <Text style={[gb.goalMarkerSmall, { color: colors.foreground }]}>▼</Text>
          <Text style={[gb.labelText, { color: colors.foreground }]}>
            Goal: {goalValue} {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}

const gb = StyleSheet.create({
  track: {
    height: 14,
    borderRadius: 7,
    overflow: "visible",
    position: "relative",
  },
  rangeFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  goalLine: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: "#1A1A1A",
  },
  goalMarker: {
    position: "absolute",
    top: -16,
  },
  goalMarkerText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
  },
  goalMarkerSmall: {
    fontSize: 9,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  labelText: { fontSize: 11, fontFamily: "Outfit_400Regular" },
});

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, color, label }: { status: GoalStatus; color: string; label: string }) {
  const icon: Record<GoalStatus, string> = {
    exceeds_goal: "trending-up",
    on_track: "checkmark-circle",
    at_risk: "warning",
    below_goal: "alert-circle",
  };
  return (
    <View style={[sb.badge, { backgroundColor: color + "1A" }]}>
      <Ionicons name={icon[status] as any} size={13} color={color} />
      <Text style={[sb.text, { color }]}>{label}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  text: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
});

// ── Total production row ──────────────────────────────────────────────────────

function ProductionRow({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={pr.row}>
      <Text style={[pr.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          pr.value,
          { color: accent ? colors.primary : colors.foreground },
        ]}
      >
        {value.toLocaleString()}{" "}
        <Text style={[pr.unit, { color: colors.mutedForeground }]}>{unit}</Text>
      </Text>
    </View>
  );
}

const pr = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13, fontFamily: "Outfit_400Regular" },
  value: { fontSize: 14, fontFamily: "Outfit_700Bold" },
  unit: { fontSize: 12, fontFamily: "Outfit_400Regular" },
});

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  farmId,
  projectedLow,
  projectedHigh,
  unit,
}: {
  farmId: number;
  projectedLow: number;
  projectedHigh: number;
  unit: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        es.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[es.iconWrap, { backgroundColor: colors.primary + "14" }]}>
        <Ionicons name="trophy-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[es.title, { color: colors.foreground }]}>
        Set a yield goal
      </Text>
      <Text style={[es.body, { color: colors.mutedForeground }]}>
        Add a per-acre target to track your season performance. Current forecast:{" "}
        <Text style={{ fontFamily: "Outfit_600SemiBold", color: colors.foreground }}>
          {projectedLow}–{projectedHigh} {unit}
        </Text>
      </Text>
      <Pressable
        style={({ pressed }) => [
          es.btn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/agriculture/edit/${farmId}` as any);
        }}
      >
        <Ionicons name="flag-outline" size={16} color="#fff" />
        <Text style={es.btnText}>Set Yield Goal</Text>
      </Pressable>
    </View>
  );
}

const es = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: { fontSize: 16, fontFamily: "Outfit_700Bold", textAlign: "center" },
  body: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  btn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 99,
  },
  btnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#fff" },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function YieldGoalCard({ profile, insights }: Props) {
  const colors = useColors();

  const result = computeYieldGoal({
    insights,
    goalValue: profile.yieldGoal,
    acreage: profile.acreage,
  });

  const {
    hasGoal,
    goalValue,
    unit,
    unitLong,
    projectedLow,
    projectedHigh,
    projectedMid,
    percentOfGoalMid,
    status,
    statusColor,
    statusLabel,
    statusDetail,
    gap,
    gapPct,
    goalTotalProduction,
    projectedTotalProduction,
    insights: tipList,
  } = result;

  if (!hasGoal) {
    return (
      <EmptyState
        farmId={profile.id}
        projectedLow={projectedLow}
        projectedHigh={projectedHigh}
        unit={unit}
      />
    );
  }

  const isAhead = gap != null && gap < 0;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View
          style={[s.iconWrap, { backgroundColor: colors.primary + "14" }]}
        >
          <Ionicons name="trophy-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            Yield Goal
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Season performance tracker
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/agriculture/edit/${profile.id}` as any);
          }}
          style={({ pressed }) => [
            s.editBtn,
            { borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={[s.editBtnText, { color: colors.mutedForeground }]}>
            Edit goal
          </Text>
        </Pressable>
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* ── Hero numbers ────────────────────────────────────────────────── */}
      <View style={s.heroRow}>
        {/* Goal */}
        <View style={s.heroBlock}>
          <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>
            Your goal
          </Text>
          <Text style={[s.heroNum, { color: colors.foreground }]}>
            {goalValue!.toLocaleString()}
          </Text>
          <Text style={[s.heroUnit, { color: colors.mutedForeground }]}>
            {unit}
          </Text>
        </View>

        {/* Divider */}
        <View style={[s.heroDivider, { backgroundColor: colors.border }]} />

        {/* Forecast mid */}
        <View style={s.heroBlock}>
          <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>
            Forecast
          </Text>
          <Text style={[s.heroNum, { color: statusColor }]}>
            {projectedMid.toLocaleString()}
          </Text>
          <Text style={[s.heroUnit, { color: colors.mutedForeground }]}>
            {unit}
          </Text>
        </View>

        {/* Divider */}
        <View style={[s.heroDivider, { backgroundColor: colors.border }]} />

        {/* % of goal */}
        <View style={s.heroBlock}>
          <Text style={[s.heroLabel, { color: colors.mutedForeground }]}>
            vs goal
          </Text>
          <Text style={[s.heroNum, { color: statusColor }]}>
            {percentOfGoalMid}%
          </Text>
          <StatusBadge
            status={status}
            color={statusColor}
            label={statusLabel}
          />
        </View>
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* ── Goal vs forecast bar ─────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
          Forecast vs Goal
        </Text>
        <GoalBar
          goalValue={goalValue!}
          projectedLow={projectedLow}
          projectedHigh={projectedHigh}
          projectedMid={projectedMid}
          unit={unit}
          statusColor={statusColor}
        />

        {/* Status detail */}
        <View
          style={[
            s.statusBox,
            {
              backgroundColor: statusColor + "12",
              borderColor: statusColor + "30",
            },
          ]}
        >
          <View
            style={[s.statusBar, { backgroundColor: statusColor }]}
          />
          <Text style={[s.statusText, { color: colors.foreground }]}>
            {statusDetail}
          </Text>
          {gap != null && (
            <Text
              style={[
                s.gapBadge,
                { color: statusColor },
              ]}
            >
              {isAhead
                ? `+${Math.abs(gap).toLocaleString()} ${unit} ahead`
                : `${Math.abs(gap).toLocaleString()} ${unit} gap (${Math.abs(gapPct ?? 0)}%)`}
            </Text>
          )}
        </View>
      </View>

      {/* ── Total production (if acreage set) ───────────────────────────── */}
      {(goalTotalProduction != null || projectedTotalProduction != null) && (
        <>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
              Total Farm Production
              {profile.acreage
                ? ` · ${profile.acreage.toLocaleString()} acres`
                : ""}
            </Text>
            <View style={{ gap: 8 }}>
              {goalTotalProduction != null && (
                <ProductionRow
                  label="At goal rate"
                  value={goalTotalProduction}
                  unit={unitLong}
                />
              )}
              {projectedTotalProduction != null && (
                <ProductionRow
                  label="Projected (midpoint)"
                  value={projectedTotalProduction}
                  unit={unitLong}
                  accent
                />
              )}
            </View>
          </View>
        </>
      )}

      {/* ── Insights ────────────────────────────────────────────────────── */}
      {tipList.length > 0 && (
        <>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <View style={s.section}>
            <Text
              style={[s.sectionLabel, { color: colors.mutedForeground }]}
            >
              Recommended Actions
            </Text>
            {tipList.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View
                  style={[s.tipDot, { backgroundColor: statusColor }]}
                />
                <Text
                  style={[s.tipText, { color: colors.foreground }]}
                >
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────── */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={colors.mutedForeground}
        />
        <Text style={[s.footerText, { color: colors.mutedForeground }]}>
          Forecast uses USDA crop baselines adjusted for observed season stress.
          Verify with your agronomist before making market commitments.
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontFamily: "Outfit_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Outfit_400Regular" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, fontFamily: "Outfit_500Medium" },
  divider: { height: 1 },

  heroRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroBlock: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroNum: { fontSize: 26, fontFamily: "Outfit_700Bold", lineHeight: 30 },
  heroUnit: { fontSize: 10, fontFamily: "Outfit_400Regular" },
  heroDivider: { width: 1, marginVertical: 14 },

  section: { padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexWrap: "wrap",
  },
  statusBar: {
    width: 3,
    height: 30,
    borderRadius: 2,
    alignSelf: "stretch",
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 18,
    minWidth: 140,
  },
  gapBadge: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 19,
  },

  footer: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    lineHeight: 15,
  },
});
