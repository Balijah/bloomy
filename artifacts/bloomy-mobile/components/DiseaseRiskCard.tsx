/**
 * DiseaseRiskCard
 *
 * Shows a crop disease pressure assessment derived from AgricultureInsights
 * data (soil moisture, precipitation deficit, temperature, drought index).
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  🦠  Disease Risk Map       │
 *   │  [mini-map with risk circle]│
 *   │  ─────────────────────────  │
 *   │  Risk level badge + summary │
 *   │  ─────────────────────────  │
 *   │  4 × factor row             │
 *   │  ─────────────────────────  │
 *   │  Actionable advice bullets  │
 *   └─────────────────────────────┘
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AgricultureInsights } from "@workspace/api-client-react";
import FarmMap, { type FarmLocation, type FarmProfile } from "./FarmMap";
import { computeDiseaseRisk } from "@/lib/diseaseRisk";
import { useColors } from "@/hooks/useColors";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  insights: AgricultureInsights;
  currentLocationId?: number;
  locations?: FarmLocation[];
  farms?: FarmProfile[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FactorBar({
  score,
  max,
  color,
}: {
  score: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? score / max : 0;
  return (
    <View style={fb.track}>
      <View
        style={[
          fb.fill,
          { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const fb = StyleSheet.create({
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  fill: { height: 5, borderRadius: 3 },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function DiseaseRiskCard({
  insights,
  currentLocationId,
  locations = [],
  farms = [],
}: Props) {
  const colors = useColors();
  const risk = computeDiseaseRisk(insights);
  const [expanded, setExpanded] = useState(true);

  const showMap = currentLocationId != null && locations.length > 0;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [s.header, pressed && { opacity: 0.8 }]}
      >
        <View
          style={[s.iconWrap, { backgroundColor: risk.color + "18" }]}
        >
          <Ionicons name="bug-outline" size={18} color={risk.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            Disease Risk
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Crop disease pressure assessment
          </Text>
        </View>
        <View style={[s.levelBadge, { backgroundColor: risk.color + "22" }]}>
          <Text style={[s.levelBadgeText, { color: risk.color }]}>
            {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      {expanded && (
        <>
          {/* ── Map overlay ──────────────────────────────────────────────── */}
          {showMap && (
            <View style={s.mapWrap}>
              <FarmMap
                currentLocationId={currentLocationId!}
                locations={locations}
                farms={farms}
                alerts={[]}
                circleColorOverride={risk.color}
              />
              {/* Disease pressure legend overlay */}
              <View style={[s.mapLegend, { backgroundColor: risk.color }]}>
                <Ionicons name="bug-outline" size={12} color="#fff" />
                <Text style={s.mapLegendText}>{risk.label}</Text>
              </View>
            </View>
          )}

          {/* ── Risk summary ──────────────────────────────────────────────── */}
          <View style={[s.summaryBox, { backgroundColor: risk.color + "12" }]}>
            <View style={[s.summaryBar, { backgroundColor: risk.color }]} />
            <Text style={[s.summaryText, { color: colors.foreground }]}>
              {risk.summary}
            </Text>
          </View>

          {/* ── Factor breakdown ─────────────────────────────────────────── */}
          <View style={[s.section, { borderTopColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
              Contributing Factors
            </Text>
            {risk.factors.map((f) => (
              <View key={f.name} style={s.factorRow}>
                <View
                  style={[
                    s.factorIconWrap,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={14}
                    color={colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.factorHeader}>
                    <Text style={[s.factorName, { color: colors.foreground }]}>
                      {f.name}
                    </Text>
                    <Text
                      style={[s.factorValue, { color: colors.mutedForeground }]}
                    >
                      {f.value}
                    </Text>
                  </View>
                  <FactorBar score={f.score} max={f.max} color={risk.color} />
                  <Text
                    style={[s.factorDetail, { color: colors.mutedForeground }]}
                  >
                    {f.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Crop-specific advice ──────────────────────────────────────── */}
          <View style={[s.section, { borderTopColor: colors.border }]}>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
              Recommended Actions
            </Text>
            {risk.advice.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={[s.tipDot, { backgroundColor: risk.color }]} />
                <Text style={[s.tipText, { color: colors.foreground }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Disclaimer ────────────────────────────────────────────────── */}
          <View
            style={[s.disclaimer, { borderTopColor: colors.border }]}
          >
            <Ionicons
              name="information-circle-outline"
              size={13}
              color={colors.mutedForeground}
            />
            <Text
              style={[s.disclaimerText, { color: colors.mutedForeground }]}
            >
              Based on soil moisture, precipitation, and temperature data. Verify
              with in-field scouting before any treatment decision.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
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
  title: {
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  levelBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },

  mapWrap: {
    position: "relative",
  },
  mapLegend: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapLegendText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },

  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  summaryBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    minHeight: 20,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 19,
  },

  section: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  factorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  factorIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  factorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factorName: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  factorValue: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
  },
  factorDetail: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    lineHeight: 16,
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

  disclaimer: {
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    lineHeight: 15,
  },
});
