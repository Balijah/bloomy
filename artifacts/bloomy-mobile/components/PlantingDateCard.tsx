/**
 * PlantingDateCard
 *
 * Displays the planting date tracker, GDD progress toward harvest, and a
 * projected days-to-harvest countdown.  All data is derived from the
 * already-loaded FarmProfile + AgricultureInsights — no extra API calls.
 *
 * States:
 *   1. No planting date recorded → empty state with CTA to edit farm
 *   2. Planting date set, harvest not reached → tracker with countdown
 *   3. GDD threshold met → "Harvest window reached" banner
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  AgricultureInsights,
  FarmProfile,
} from "@workspace/api-client-react";
import {
  computePlantingCalendar,
  formatMonthDay,
  formatShortDate,
} from "@/lib/plantingCalendar";
import { useColors } from "@/hooks/useColors";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  profile: FarmProfile;
  insights: AgricultureInsights;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        sp.pill,
        {
          backgroundColor: accent ? colors.primary + "12" : colors.muted,
          borderColor: accent ? colors.primary + "30" : colors.border,
        },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={13}
        color={accent ? colors.primary : colors.mutedForeground}
      />
      <View>
        <Text style={[sp.pillLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[
            sp.pillValue,
            { color: accent ? colors.primary : colors.foreground },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillLabel: { fontSize: 10, fontFamily: "Outfit_500Medium" },
  pillValue: { fontSize: 13, fontFamily: "Outfit_700Bold", marginTop: 1 },
});

// ── GDD Progress bar ──────────────────────────────────────────────────────────

function GDDBar({
  progress,
  accumulated,
  harvestGDD,
}: {
  progress: number;
  accumulated: number;
  harvestGDD: number;
}) {
  const colors = useColors();
  const pct = Math.round(progress * 100);
  const isNearHarvest = pct >= 80;
  const barColor = isNearHarvest ? "#E8A020" : colors.primary;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[gb.label, { color: colors.mutedForeground }]}>
          GDD toward harvest
        </Text>
        <Text style={[gb.value, { color: colors.foreground }]}>
          {accumulated.toLocaleString()} / {harvestGDD.toLocaleString()} GDD
        </Text>
      </View>
      <View style={[gb.track, { backgroundColor: colors.muted }]}>
        <View
          style={[
            gb.fill,
            { width: `${pct}%` as any, backgroundColor: barColor },
          ]}
        />
        {/* Harvest marker */}
        <View style={[gb.marker, { right: 0 }]}>
          <Ionicons name="flag" size={8} color={barColor} />
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[gb.sublabel, { color: barColor, fontFamily: "Outfit_600SemiBold" }]}>
          {pct}% accumulated
        </Text>
        {pct < 100 && (
          <Text style={[gb.sublabel, { color: colors.mutedForeground }]}>
            {(harvestGDD - accumulated).toLocaleString()} GDD remaining
          </Text>
        )}
      </View>
    </View>
  );
}

const gb = StyleSheet.create({
  label: { fontSize: 11, fontFamily: "Outfit_500Medium" },
  value: { fontSize: 11, fontFamily: "Outfit_600SemiBold" },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: "visible",
    position: "relative",
  },
  fill: { height: 10, borderRadius: 5 },
  marker: {
    position: "absolute",
    top: -1,
    alignItems: "center",
  },
  sublabel: { fontSize: 11, fontFamily: "Outfit_400Regular" },
});

// ── Harvest countdown banner ──────────────────────────────────────────────────

function HarvestCountdown({
  daysToHarvest,
  projectedDate,
  dailyGDDRate,
  harvestWindowReached,
}: {
  daysToHarvest: number | null;
  projectedDate: Date | null;
  dailyGDDRate: number | null;
  harvestWindowReached: boolean;
}) {
  const colors = useColors();

  if (harvestWindowReached) {
    return (
      <View
        style={[
          hc.box,
          { backgroundColor: "#E8A020" + "18", borderColor: "#E8A020" + "44" },
        ]}
      >
        <Ionicons name="ribbon-outline" size={20} color="#E8A020" />
        <View style={{ flex: 1 }}>
          <Text style={[hc.title, { color: "#E8A020" }]}>
            Harvest Window Reached
          </Text>
          <Text style={[hc.sub, { color: colors.mutedForeground }]}>
            GDD accumulation has met the harvest threshold. Monitor crop maturity
            and plan logistics.
          </Text>
        </View>
      </View>
    );
  }

  if (daysToHarvest == null || projectedDate == null) {
    return (
      <View
        style={[
          hc.box,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
        <Text style={[hc.sub, { color: colors.mutedForeground }]}>
          Harvest estimate unavailable — no GDD forecast data.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        hc.box,
        {
          backgroundColor: colors.primary + "0E",
          borderColor: colors.primary + "28",
        },
      ]}
    >
      {/* Big countdown number */}
      <View style={hc.countdownWrap}>
        <Text style={[hc.countdownNum, { color: colors.primary }]}>
          {daysToHarvest}
        </Text>
        <Text style={[hc.countdownUnit, { color: colors.primary }]}>
          {daysToHarvest === 1 ? "day" : "days"}
        </Text>
      </View>

      <View style={hc.right}>
        <Text style={[hc.title, { color: colors.foreground }]}>
          Projected harvest
        </Text>
        <Text style={[hc.date, { color: colors.primary }]}>
          {formatShortDate(projectedDate)}
        </Text>
        {dailyGDDRate != null && (
          <Text style={[hc.sub, { color: colors.mutedForeground }]}>
            At ~{dailyGDDRate.toFixed(1)} GDD/day (15-day forecast)
          </Text>
        )}
      </View>
    </View>
  );
}

const hc = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  countdownWrap: {
    alignItems: "center",
    minWidth: 54,
  },
  countdownNum: {
    fontSize: 36,
    fontFamily: "Outfit_700Bold",
    lineHeight: 40,
  },
  countdownUnit: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    marginTop: 2,
  },
  right: { flex: 1, gap: 3 },
  title: { fontSize: 12, fontFamily: "Outfit_500Medium" },
  date: { fontSize: 18, fontFamily: "Outfit_700Bold", lineHeight: 22 },
  sub: { fontSize: 11, fontFamily: "Outfit_400Regular", lineHeight: 15 },
});

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ farmId }: { farmId: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        es.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[es.iconWrap, { backgroundColor: colors.primary + "14" }]}>
        <Ionicons name="calendar-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[es.title, { color: colors.foreground }]}>
        Track your planting progress
      </Text>
      <Text style={[es.body, { color: colors.mutedForeground }]}>
        Add your planting date to see accumulated GDD, growth stage progress, and
        a projected harvest date based on your local weather forecast.
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
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <Text style={es.btnText}>Set Planting Date</Text>
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

export default function PlantingDateCard({ profile, insights }: Props) {
  const colors = useColors();

  const cal = computePlantingCalendar({
    cropType: profile.cropType,
    plantingDate: profile.plantingDate,
    harvestDate: profile.harvestDate,
    accumulatedGDD: insights.accumulatedGDD,
    growingDegreeDaysForecast: insights.growingDegreeDaysForecast,
  });

  if (!cal.hasPlantingDate) {
    return <EmptyState farmId={profile.id} />;
  }

  const accumulated = insights.accumulatedGDD ?? 0;

  return (
    <View
      style={[
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={[s.iconWrap, { backgroundColor: colors.primary + "14" }]}>
          <Ionicons name="leaf-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            Planting Tracker
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {profile.cropType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
          <Ionicons name="create-outline" size={14} color={colors.mutedForeground} />
          <Text style={[s.editBtnText, { color: colors.mutedForeground }]}>
            Edit dates
          </Text>
        </Pressable>
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Stat pills row */}
      <View style={s.pillRow}>
        <StatPill
          icon="calendar-outline"
          label="Planted"
          value={
            cal.plantingDateObj ? formatMonthDay(cal.plantingDateObj) : "—"
          }
          accent
        />
        <StatPill
          icon="time-outline"
          label="Days in field"
          value={
            cal.daysSincePlanting != null
              ? `${cal.daysSincePlanting} days`
              : "—"
          }
        />
        {cal.harvestDateObj ? (
          <StatPill
            icon="flag-outline"
            label="Target harvest"
            value={formatMonthDay(cal.harvestDateObj)}
          />
        ) : (
          <StatPill
            icon="speedometer-outline"
            label="Daily GDD rate"
            value={
              cal.dailyGDDRate != null
                ? `~${cal.dailyGDDRate.toFixed(1)}/day`
                : "—"
            }
          />
        )}
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* GDD Progress bar */}
      <View style={s.section}>
        <GDDBar
          progress={cal.gddProgress}
          accumulated={accumulated}
          harvestGDD={cal.harvestGDD}
        />
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Harvest countdown */}
      <View style={s.section}>
        <Text
          style={[s.sectionLabel, { color: colors.mutedForeground }]}
        >
          Harvest Countdown
        </Text>
        <HarvestCountdown
          daysToHarvest={cal.projectedDaysToHarvest}
          projectedDate={cal.projectedHarvestDate}
          dailyGDDRate={cal.dailyGDDRate}
          harvestWindowReached={cal.harvestWindowReached}
        />
      </View>

      {/* Disclaimer */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={colors.mutedForeground}
        />
        <Text style={[s.footerText, { color: colors.mutedForeground }]}>
          Harvest estimate is based on accumulated GDD since planting and the
          15-day forecast. Actual harvest depends on crop variety and field
          conditions.
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
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  section: { padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
