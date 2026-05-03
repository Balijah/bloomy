/**
 * InsuranceCard
 *
 * Displays federal crop insurance coverage details and indemnity projections
 * across three forecast scenarios (low / mid / high).
 *
 * Requires profile fields: aphYield, insurancePlanType, coverageLevel,
 * projectedPrice, priceElection.
 *
 * Shows an empty/setup state when fields are missing.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  AgricultureInsights,
  FarmProfile,
} from "@workspace/api-client-react";
import { computeYieldGoal } from "@/lib/yieldGoal";
import {
  computeInsurance,
  type InsurancePlanType,
  type InsuranceResult,
  type InsuranceScenario,
  COVERAGE_LEVELS,
  PRICE_ELECTION_OPTIONS,
  RMA_PROJECTED_PRICES_2025,
} from "@/lib/insuranceMath";
import { useColors } from "@/hooks/useColors";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  profile: FarmProfile;
  insights: AgricultureInsights;
}

// ── Plan type labels ──────────────────────────────────────────────────────────

const PLAN_LABELS: Record<InsurancePlanType, { short: string; long: string; desc: string }> = {
  RP: {
    short: "RP",
    long: "Revenue Protection",
    desc: "Guarantees revenue based on APH × coverage × the higher of projected or harvest price.",
  },
  RPHPE: {
    short: "RP-HPE",
    long: "Revenue Protection – Harvest Price Exclusion",
    desc: "Like RP but the harvest price cannot raise the guarantee above the projected price.",
  },
  YP: {
    short: "YP",
    long: "Yield Protection",
    desc: "Pays if actual yield falls below APH × coverage, regardless of price movement.",
  },
};

// ── Empty / setup state ───────────────────────────────────────────────────────

function SetupPrompt({
  profile,
  colors,
}: {
  profile: FarmProfile;
  colors: ReturnType<typeof useColors>;
}) {
  const missing: string[] = [];
  if (!profile.aphYield) missing.push("APH yield");
  if (!profile.insurancePlanType) missing.push("plan type");
  if (!profile.coverageLevel) missing.push("coverage level");
  if (!profile.projectedPrice) missing.push("projected price");

  return (
    <View style={[sp.wrap, { borderColor: colors.border }]}>
      <View style={[sp.iconCircle, { backgroundColor: "#366441" + "18" }]}>
        <Ionicons name="shield-outline" size={28} color="#366441" />
      </View>
      <Text style={[sp.title, { color: colors.foreground }]}>
        Set up crop insurance
      </Text>
      <Text style={[sp.body, { color: colors.mutedForeground }]}>
        Enter your federal crop insurance details to see indemnity projections
        overlaid on your yield forecast.
      </Text>
      {missing.length > 0 && (
        <View style={[sp.missingBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[sp.missingLabel, { color: colors.mutedForeground }]}>
            Still needed
          </Text>
          {missing.map((m) => (
            <View key={m} style={sp.missingRow}>
              <Ionicons name="ellipse" size={5} color={colors.mutedForeground} />
              <Text style={[sp.missingText, { color: colors.mutedForeground }]}>{m}</Text>
            </View>
          ))}
        </View>
      )}
      <Pressable
        style={[sp.btn, { backgroundColor: "#366441" }]}
        onPress={() => router.push(`/agriculture/edit/${profile.id}`)}
      >
        <Ionicons name="settings-outline" size={14} color="#fff" />
        <Text style={sp.btnText}>Configure insurance</Text>
      </Pressable>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: { fontSize: 15, fontFamily: "Outfit_700Bold" },
  body: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  missingBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    width: "100%",
  },
  missingLabel: { fontSize: 10, fontFamily: "Outfit_600SemiBold", marginBottom: 2 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  missingText: { fontSize: 13, fontFamily: "Outfit_400Regular" },
  btn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
  },
  btnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#fff" },
});

// ── Scenario row ──────────────────────────────────────────────────────────────

function ScenarioRow({
  scenario,
  unit,
  colors,
}: {
  scenario: InsuranceScenario;
  unit: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { label, forecastYield, actualRevenue, indemnity, netPosition } = scenario;

  const scenarioColors: Record<string, string> = {
    Low: "#C15A3A",
    Mid: "#366441",
    High: "#2D9B5A",
  };
  const labelColor = scenarioColors[label] ?? colors.foreground;

  const netColor =
    netPosition == null
      ? colors.foreground
      : netPosition >= 0
      ? "#2D9B5A"
      : "#D02020";

  return (
    <View style={[sr.row, { borderColor: colors.border }]}>
      {/* Scenario badge */}
      <View style={[sr.badge, { backgroundColor: labelColor + "18" }]}>
        <Text style={[sr.badgeText, { color: labelColor }]}>{label}</Text>
      </View>

      {/* Yield */}
      <View style={sr.cell}>
        <Text style={[sr.val, { color: colors.foreground }]}>
          {forecastYield % 1 === 0 ? forecastYield : forecastYield.toFixed(1)}
        </Text>
        <Text style={[sr.lbl, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>

      {/* Indemnity */}
      <View style={sr.cell}>
        <Text style={[sr.val, { color: indemnity > 0 ? "#2D9B5A" : colors.mutedForeground }]}>
          {indemnity > 0 ? `+$${indemnity.toLocaleString()}` : "—"}
        </Text>
        <Text style={[sr.lbl, { color: colors.mutedForeground }]}>indemnity</Text>
      </View>

      {/* Net position */}
      <View style={sr.cell}>
        <Text style={[sr.val, { color: netColor }]}>
          {netPosition != null
            ? `${netPosition >= 0 ? "+" : ""}$${Math.abs(netPosition).toLocaleString()}`
            : "—"}
        </Text>
        <Text style={[sr.lbl, { color: colors.mutedForeground }]}>net</Text>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    minWidth: 38,
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontFamily: "Outfit_700Bold" },
  cell: { flex: 1, alignItems: "center", gap: 1 },
  val: { fontSize: 13, fontFamily: "Outfit_700Bold" },
  lbl: { fontSize: 9, fontFamily: "Outfit_400Regular" },
});

// ── Coverage gauge ────────────────────────────────────────────────────────────

function CoverageGauge({
  level,
  statusColor,
  colors,
}: {
  level: number;
  statusColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  const pct = Math.round(level * 100);
  return (
    <View style={cg.wrap}>
      <View style={[cg.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            cg.fill,
            { width: `${pct}%` as any, backgroundColor: statusColor },
          ]}
        />
      </View>
      <Text style={[cg.label, { color: statusColor }]}>{pct}% coverage</Text>
    </View>
  );
}

const cg = StyleSheet.create({
  wrap: { gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  label: { fontSize: 11, fontFamily: "Outfit_600SemiBold", textAlign: "right" },
});

// ── Main card ─────────────────────────────────────────────────────────────────

export default function InsuranceCard({ profile, insights }: Props) {
  const colors = useColors();
  const [showHow, setShowHow] = useState(false);

  // Need minimum: aphYield, planType, coverageLevel, projectedPrice
  const canCompute =
    profile.aphYield != null &&
    profile.insurancePlanType != null &&
    profile.coverageLevel != null &&
    profile.projectedPrice != null;

  // Get forecast values
  const { projectedLow, projectedMid, projectedHigh } = computeYieldGoal({
    insights,
    goalValue: profile.yieldGoal,
    acreage: profile.acreage,
    cropPrice: profile.cropPrice,
    costPerAcre: profile.costPerAcre,
  });

  if (!canCompute) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={[s.iconWrap, { backgroundColor: "#366441" + "18" }]}>
              <Ionicons name="shield" size={20} color="#366441" />
            </View>
            <View>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Crop Insurance</Text>
              <Text style={[s.cardSub, { color: colors.mutedForeground }]}>Not configured</Text>
            </View>
          </View>
        </View>
        <SetupPrompt profile={profile} colors={colors} />
      </View>
    );
  }

  const result: InsuranceResult = computeInsurance({
    planType: profile.insurancePlanType as InsurancePlanType,
    aphYield: profile.aphYield!,
    coverageLevel: profile.coverageLevel!,
    projectedPrice: profile.projectedPrice!,
    priceElection: profile.priceElection ?? 1.0,
    cropType: profile.cropType,
    cropPrice: profile.cropPrice,
    acreage: profile.acreage,
    costPerAcre: profile.costPerAcre,
    forecastLow: projectedLow,
    forecastMid: projectedMid,
    forecastHigh: projectedHigh,
  });

  const {
    planType, coverageLevel, yieldGuarantee, revenueGuaranteePerAcre,
    totalLiability, scenarios, status, statusColor, statusLabel, statusDetail, unit,
  } = result;

  const planMeta = PLAN_LABELS[planType];
  const statusIcon =
    status === "protected"
      ? "shield-checkmark"
      : status === "partial"
      ? "shield-half"
      : "shield-outline";

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.iconWrap, { backgroundColor: statusColor + "18" }]}>
            <Ionicons name={statusIcon as any} size={20} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Crop Insurance</Text>
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>
              {planMeta.short} · {Math.round(coverageLevel * 100)}% coverage
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push(`/agriculture/edit/${profile.id}`)}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Status banner */}
      <View style={[s.banner, { backgroundColor: statusColor + "12", borderColor: statusColor + "30" }]}>
        <View style={[s.bannerBar, { backgroundColor: statusColor }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.bannerTitle, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={[s.bannerBody, { color: colors.foreground }]}>{statusDetail}</Text>
        </View>
      </View>

      {/* Coverage gauge */}
      <CoverageGauge level={coverageLevel} statusColor={statusColor} colors={colors} />

      {/* Key guarantees */}
      <View style={s.guaranteeGrid}>
        <View style={[s.guaranteeCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[s.guaranteeLabel, { color: colors.mutedForeground }]}>Yield guarantee</Text>
          <Text style={[s.guaranteeValue, { color: colors.foreground }]}>
            {yieldGuarantee % 1 === 0 ? yieldGuarantee : yieldGuarantee.toFixed(1)}
          </Text>
          <Text style={[s.guaranteeUnit, { color: colors.mutedForeground }]}>{unit}</Text>
        </View>

        {revenueGuaranteePerAcre != null && (
          <View style={[s.guaranteeCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[s.guaranteeLabel, { color: colors.mutedForeground }]}>Revenue guarantee</Text>
            <Text style={[s.guaranteeValue, { color: colors.foreground }]}>
              ${revenueGuaranteePerAcre.toLocaleString()}
            </Text>
            <Text style={[s.guaranteeUnit, { color: colors.mutedForeground }]}>/acre</Text>
          </View>
        )}

        {totalLiability != null && (
          <View style={[s.guaranteeCell, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[s.guaranteeLabel, { color: colors.mutedForeground }]}>Total liability</Text>
            <Text style={[s.guaranteeValue, { color: colors.foreground }]}>
              ${totalLiability.toLocaleString()}
            </Text>
            <Text style={[s.guaranteeUnit, { color: colors.mutedForeground }]}>all acres</Text>
          </View>
        )}
      </View>

      {/* Scenario table */}
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <View>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
          Indemnity Projections · by forecast scenario
        </Text>
        {/* Column headers */}
        <View style={[sr.row, { borderColor: "transparent" }]}>
          <View style={{ minWidth: 38 }} />
          <View style={sr.cell}>
            <Text style={[sr.lbl, { color: colors.mutedForeground }]}>yield/acre</Text>
          </View>
          <View style={sr.cell}>
            <Text style={[sr.lbl, { color: colors.mutedForeground }]}>indemnity</Text>
          </View>
          <View style={sr.cell}>
            <Text style={[sr.lbl, { color: colors.mutedForeground }]}>net position</Text>
          </View>
        </View>
        {scenarios.map((sc) => (
          <ScenarioRow key={sc.label} scenario={sc} unit={unit} colors={colors} />
        ))}
        {profile.acreage == null && (
          <Text style={[s.note, { color: colors.mutedForeground }]}>
            Add acreage to your farm profile to see total indemnity and net position.
          </Text>
        )}
      </View>

      {/* How it works toggle */}
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Pressable style={s.toggleRow} onPress={() => setShowHow((v) => !v)}>
        <Text style={[s.toggleText, { color: colors.mutedForeground }]}>
          How {planMeta.short} works
        </Text>
        <Ionicons
          name={showHow ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>
      {showHow && (
        <View style={[s.howBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[s.howTitle, { color: colors.foreground }]}>{planMeta.long}</Text>
          <Text style={[s.howBody, { color: colors.mutedForeground }]}>{planMeta.desc}</Text>
          <View style={[s.howDivider, { backgroundColor: colors.border }]} />
          <View style={s.howRow}>
            <Text style={[s.howKey, { color: colors.mutedForeground }]}>APH yield</Text>
            <Text style={[s.howVal, { color: colors.foreground }]}>
              {profile.aphYield} {unit}
            </Text>
          </View>
          <View style={s.howRow}>
            <Text style={[s.howKey, { color: colors.mutedForeground }]}>Coverage level</Text>
            <Text style={[s.howVal, { color: colors.foreground }]}>
              {Math.round(coverageLevel * 100)}%
            </Text>
          </View>
          <View style={s.howRow}>
            <Text style={[s.howKey, { color: colors.mutedForeground }]}>Projected price (RMA)</Text>
            <Text style={[s.howVal, { color: colors.foreground }]}>
              ${profile.projectedPrice}{unit.replace("acre", "").replace("/", "").trim() ? `/${unit.split("/")[0]}` : "/unit"}
            </Text>
          </View>
          {planType === "YP" && (
            <View style={s.howRow}>
              <Text style={[s.howKey, { color: colors.mutedForeground }]}>Price election</Text>
              <Text style={[s.howVal, { color: colors.foreground }]}>
                {Math.round((profile.priceElection ?? 1.0) * 100)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={12} color={colors.mutedForeground} />
        <Text style={[s.footerText, { color: colors.mutedForeground }]}>
          Estimates based on RMA plan formulas. Actual premiums, guarantees, and
          indemnities are determined by your AIP and may vary. Consult your crop
          insurance agent before making coverage decisions.
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Outfit_700Bold" },
  cardSub: { fontSize: 12, fontFamily: "Outfit_400Regular", marginTop: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerBar: { width: 3, height: 36, borderRadius: 2, marginTop: 2 },
  bannerTitle: { fontSize: 13, fontFamily: "Outfit_700Bold" },
  bannerBody: { fontSize: 12, fontFamily: "Outfit_400Regular", lineHeight: 17 },
  guaranteeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  guaranteeCell: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
    flex: 1,
    minWidth: 90,
  },
  guaranteeLabel: { fontSize: 9, fontFamily: "Outfit_500Medium", textAlign: "center" },
  guaranteeValue: { fontSize: 20, fontFamily: "Outfit_700Bold", lineHeight: 24 },
  guaranteeUnit: { fontSize: 9, fontFamily: "Outfit_400Regular" },
  divider: { height: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 11, fontFamily: "Outfit_600SemiBold", marginBottom: 2 },
  note: { fontSize: 11, fontFamily: "Outfit_400Regular", marginTop: 6, fontStyle: "italic" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  toggleText: { fontSize: 12, fontFamily: "Outfit_500Medium" },
  howBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  howTitle: { fontSize: 13, fontFamily: "Outfit_700Bold" },
  howBody: { fontSize: 12, fontFamily: "Outfit_400Regular", lineHeight: 17 },
  howDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  howRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  howKey: { fontSize: 12, fontFamily: "Outfit_400Regular" },
  howVal: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1, fontSize: 10, fontFamily: "Outfit_400Regular", lineHeight: 14 },
});
