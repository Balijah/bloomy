import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface DayData {
  date: Date | string;
  uvIndexMax: number;
}

interface Props {
  data: DayData[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// WHO UV index categories
const UV_BANDS = [
  { min: 11, label: "Extreme",   color: "#9333EA", textColor: "#7C3AED" },
  { min: 8,  label: "Very High", color: "#EF4444", textColor: "#DC2626" },
  { min: 6,  label: "High",      color: "#F97316", textColor: "#EA580C" },
  { min: 3,  label: "Moderate",  color: "#EAB308", textColor: "#CA8A04" },
  { min: 0,  label: "Low",       color: "#22C55E", textColor: "#16A34A" },
];

function uvCategory(uv: number) {
  return UV_BANDS.find((b) => uv >= b.min) ?? UV_BANDS[UV_BANDS.length - 1];
}

function parseDateSafe(raw: Date | string): Date {
  const d = new Date(raw as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Gradient id for a given UV value
function gradId(uv: number): string {
  if (uv >= 11) return "uvExtreme";
  if (uv >= 8)  return "uvVeryHigh";
  if (uv >= 6)  return "uvHigh";
  if (uv >= 3)  return "uvModerate";
  return "uvLow";
}

export default function UVChart({ data }: Props) {
  const colors = useColors();
  const s = styles(colors);
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  if (!data || data.length === 0) return null;

  // ── layout constants ─────────────────────────────────────────────────────────
  const PAD_H   = 10;
  const PAD_TOP = 16;   // room above highest bar label
  const CHART_H = 130;
  const LABEL_H = 40;   // day name + category text
  const SVG_H   = PAD_TOP + CHART_H + LABEL_H;

  // ── UV scale: always at least 0–11 so bands are visible ─────────────────────
  const maxUV   = Math.max(11, ...data.map((d) => d.uvIndexMax));
  const yOf     = (uv: number) =>
    PAD_TOP + CHART_H - (uv / maxUV) * CHART_H;

  const innerW     = containerWidth - PAD_H * 2;
  const barGroupW  = data.length > 0 ? innerW / data.length : 0;
  const barW       = Math.max(4, barGroupW * 0.52);

  // Background zone rects (bottom to top: Low, Moderate, High, Very High, Extreme)
  const zoneBands = [
    { lo: 0,  hi: 3,  color: "#22C55E" },
    { lo: 3,  hi: 6,  color: "#EAB308" },
    { lo: 6,  hi: 8,  color: "#F97316" },
    { lo: 8,  hi: 11, color: "#EF4444" },
    { lo: 11, hi: maxUV + 0.5, color: "#9333EA" },
  ];

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>7-Day UV Index</Text>
        <View style={s.legend}>
          {[
            { label: "Low",       color: "#22C55E" },
            { label: "Mod",       color: "#EAB308" },
            { label: "High",      color: "#F97316" },
            { label: "V.High",    color: "#EF4444" },
            { label: "Extreme",   color: "#9333EA" },
          ].map(({ label, color }) => (
            <View key={label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: color }]} />
              <Text style={s.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Chart ── */}
      <View onLayout={onLayout}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={SVG_H}>
            <Defs>
              {[
                { id: "uvLow",      top: "#4ADE80", bot: "#BBF7D0" },
                { id: "uvModerate", top: "#FACC15", bot: "#FEF08A" },
                { id: "uvHigh",     top: "#FB923C", bot: "#FED7AA" },
                { id: "uvVeryHigh", top: "#F87171", bot: "#FECACA" },
                { id: "uvExtreme",  top: "#C084FC", bot: "#E9D5FF" },
              ].map(({ id, top, bot }) => (
                <LinearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={top} stopOpacity="1" />
                  <Stop offset="100%" stopColor={bot} stopOpacity="0.8" />
                </LinearGradient>
              ))}
            </Defs>

            {/* ── Background zone bands ── */}
            {zoneBands.map(({ lo, hi, color }) => {
              const y1 = yOf(Math.min(hi, maxUV));
              const y2 = yOf(lo);
              if (y2 <= PAD_TOP || y1 >= PAD_TOP + CHART_H) return null;
              const clampedY1 = Math.max(y1, PAD_TOP);
              const clampedY2 = Math.min(y2, PAD_TOP + CHART_H);
              return (
                <Rect
                  key={lo}
                  x={PAD_H}
                  y={clampedY1}
                  width={innerW}
                  height={Math.max(0, clampedY2 - clampedY1)}
                  fill={color}
                  opacity={0.08}
                />
              );
            })}

            {/* ── Baseline ── */}
            <Rect
              x={PAD_H}
              y={PAD_TOP + CHART_H}
              width={innerW}
              height={1}
              fill={colors.border}
            />

            {/* ── Bars + labels ── */}
            {data.map((day, i) => {
              const date    = parseDateSafe(day.date);
              const isToday = new Date().toDateString() === date.toDateString();
              const dayLbl  = isToday ? "Today" : DAY_LABELS[date.getDay()];
              const cat     = uvCategory(day.uvIndexMax);
              const cx      = PAD_H + i * barGroupW + barGroupW / 2;
              const barH    = Math.max(2, (day.uvIndexMax / maxUV) * CHART_H);
              const barY    = PAD_TOP + CHART_H - barH;

              return (
                <G key={i}>
                  {/* Today column tint */}
                  {isToday && (
                    <Rect
                      x={cx - barGroupW / 2}
                      y={PAD_TOP}
                      width={barGroupW}
                      height={CHART_H}
                      fill={colors.primary}
                      opacity={0.06}
                      rx={4}
                    />
                  )}

                  {/* Bar */}
                  <Rect
                    x={cx - barW / 2}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx={3}
                    ry={3}
                    fill={`url(#${gradId(day.uvIndexMax)})`}
                  />

                  {/* UV number above bar */}
                  <SvgText
                    x={cx}
                    y={barY - 5}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_600SemiBold"}
                    fill={cat.textColor}
                  >
                    {Math.round(day.uvIndexMax)}
                  </SvgText>

                  {/* Day label */}
                  <SvgText
                    x={cx}
                    y={PAD_TOP + CHART_H + 15}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_500Medium"}
                    fill={isToday ? colors.primary : colors.foreground}
                  >
                    {dayLbl}
                  </SvgText>

                  {/* Category label */}
                  <SvgText
                    x={cx}
                    y={PAD_TOP + CHART_H + 29}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="Outfit_500Medium"
                    fill={cat.textColor}
                  >
                    {cat.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        )}
      </View>

      {/* ── Summary row ── */}
      <View style={s.summaryRow}>
        {(() => {
          const vals       = data.map((d) => d.uvIndexMax);
          const peakUV     = Math.max(...vals);
          const avgUV      = vals.reduce((a, b) => a + b, 0) / vals.length;
          const highDays   = data.filter((d) => d.uvIndexMax >= 6).length;
          const peakCat    = uvCategory(peakUV);
          const peakDay    = data.find((d) => d.uvIndexMax === peakUV);
          const peakDate   = peakDay ? parseDateSafe(peakDay.date) : null;
          const peakDayLbl =
            peakDate?.toDateString() === new Date().toDateString()
              ? "Today"
              : peakDate
              ? DAY_LABELS[peakDate.getDay()]
              : "—";

          return (
            <>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: uvCategory(avgUV).textColor }]}>
                  {avgUV.toFixed(1)}
                </Text>
                <Text style={s.summaryLabel}>avg UV</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: peakCat.textColor }]}>
                  {Math.round(peakUV)}
                </Text>
                <Text style={s.summaryLabel}>peak ({peakDayLbl})</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: highDays > 0 ? "#EA580C" : colors.primary }]}>
                  {highDays}
                </Text>
                <Text style={s.summaryLabel}>high+ day{highDays !== 1 ? "s" : ""}</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: peakCat.textColor, fontSize: 13 }]}>
                  {peakCat.label}
                </Text>
                <Text style={s.summaryLabel}>peak level</Text>
              </View>
            </>
          );
        })()}
      </View>

      {/* ── Protection tip ── */}
      {(() => {
        const peakUV = Math.max(...data.map((d) => d.uvIndexMax));
        if (peakUV < 3) return null;
        let tip = "";
        if (peakUV >= 11)     tip = "Extreme UV — avoid outdoor work midday; full-cover PPE required.";
        else if (peakUV >= 8) tip = "Very high UV — limit unprotected sun exposure; wear SPF 30+ and protective clothing.";
        else if (peakUV >= 6) tip = "High UV — apply sunscreen for extended fieldwork; shade breaks recommended.";
        else                  tip = "Moderate UV — sunscreen advised for fieldwork longer than 30 minutes.";
        return (
          <View style={[s.tip, { borderLeftColor: uvCategory(peakUV).color }]}>
            <Text style={s.tipText}>{tip}</Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 6,
    },
    title: {
      fontSize: 13,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    legendText: {
      fontSize: 9.5,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    summaryRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    summarySep: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    summaryValue: {
      fontSize: 16,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    summaryLabel: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    tip: {
      borderLeftWidth: 3,
      paddingLeft: 10,
      paddingVertical: 4,
    },
    tipText: {
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 18,
    },
  });
