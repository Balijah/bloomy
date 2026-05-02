import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface DayData {
  date: Date | string;
  tempMax: number;
  tempMin: number;
  feelsLikeMax?: number | null;
  feelsLikeMin?: number | null;
}

interface Props {
  data: DayData[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FROST_LINE = 32;
const HEAT_LINE = 95;

// Threshold band colours
const FROST_COLOR = "#93C5FD";
const HEAT_COLOR = "#FCA5A5";
const HIGH_COLOR = "#F97316"; // orange
const LOW_COLOR = "#3B82F6"; // blue

function parseDateSafe(raw: Date | string): Date {
  const d = new Date(raw as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

function pointsToPolygon(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export default function TempChart({ data }: Props) {
  const colors = useColors();
  const s = styles(colors);
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  if (!data || data.length === 0) return null;

  // ── dimensions ──────────────────────────────────────────────────────────────
  const PAD_H = 12;
  const PAD_TOP = 20;   // room for high-temp labels
  const PAD_BOT = 40;   // room for day labels + low-temp labels
  const CHART_H = 140;
  const SVG_H = PAD_TOP + CHART_H + PAD_BOT;

  // ── scale ────────────────────────────────────────────────────────────────────
  const allTemps = data.flatMap((d) => [d.tempMax, d.tempMin]);
  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  // widen the range slightly so points don't hug edges
  const tMin = rawMin - 6;
  const tMax = rawMax + 6;
  const tRange = tMax - tMin || 1;

  function yOf(temp: number) {
    return PAD_TOP + CHART_H - ((temp - tMin) / tRange) * CHART_H;
  }

  // ── x positions ──────────────────────────────────────────────────────────────
  const innerW = containerWidth - PAD_H * 2;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  function xOf(i: number) {
    return PAD_H + i * step;
  }

  // ── polygon band (fill between high and low) ─────────────────────────────────
  const highPts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.tempMax) }));
  const lowPts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.tempMin) }));
  const bandPolygon = [
    ...highPts,
    ...[...lowPts].reverse(),
  ];

  // ── polyline strings ──────────────────────────────────────────────────────────
  const highLine = highPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const lowLine = lowPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // ── threshold line helpers ────────────────────────────────────────────────────
  const frostY = yOf(FROST_LINE);
  const heatY = yOf(HEAT_LINE);
  const showFrost = FROST_LINE >= tMin && FROST_LINE <= tMax;
  const showHeat = HEAT_LINE >= tMin && HEAT_LINE <= tMax;

  return (
    <View style={s.card}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>7-Day Temperature Range</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: HIGH_COLOR }]} />
          <Text style={s.legendText}>High</Text>
          <View style={[s.legendDot, { backgroundColor: LOW_COLOR, marginLeft: 8 }]} />
          <Text style={s.legendText}>Low</Text>
        </View>
      </View>

      {/* ── Chart ── */}
      <View onLayout={onLayout}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={SVG_H}>
            <Defs>
              <LinearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={HIGH_COLOR} stopOpacity="0.18" />
                <Stop offset="100%" stopColor={LOW_COLOR} stopOpacity="0.12" />
              </LinearGradient>
            </Defs>

            {/* ── Frost / heat threshold bands ── */}
            {showFrost && frostY >= PAD_TOP && frostY <= PAD_TOP + CHART_H && (
              <>
                <Rect
                  x={PAD_H}
                  y={frostY}
                  width={innerW}
                  height={Math.min(6, PAD_TOP + CHART_H - frostY)}
                  fill={FROST_COLOR}
                  opacity={0.25}
                />
                <Line
                  x1={PAD_H} y1={frostY}
                  x2={PAD_H + innerW} y2={frostY}
                  stroke={FROST_COLOR}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
                <SvgText
                  x={PAD_H + 2}
                  y={frostY - 3}
                  fontSize={9}
                  fill={FROST_COLOR}
                  fontFamily="Outfit_500Medium"
                  opacity={0.9}
                >
                  32° Frost
                </SvgText>
              </>
            )}

            {showHeat && heatY >= PAD_TOP && heatY <= PAD_TOP + CHART_H && (
              <>
                <Rect
                  x={PAD_H}
                  y={heatY - 6}
                  width={innerW}
                  height={6}
                  fill={HEAT_COLOR}
                  opacity={0.25}
                />
                <Line
                  x1={PAD_H} y1={heatY}
                  x2={PAD_H + innerW} y2={heatY}
                  stroke={HEAT_COLOR}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                />
                <SvgText
                  x={PAD_H + 2}
                  y={heatY - 4}
                  fontSize={9}
                  fill={HEAT_COLOR}
                  fontFamily="Outfit_500Medium"
                  opacity={0.9}
                >
                  95° Heat
                </SvgText>
              </>
            )}

            {/* ── Band fill ── */}
            <Polygon
              points={pointsToPolygon(bandPolygon)}
              fill="url(#bandGrad)"
            />

            {/* ── Low line ── */}
            <Path
              d={`M ${lowLine.replace(/ /g, " L ")}`}
              fill="none"
              stroke={LOW_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* ── High line ── */}
            <Path
              d={`M ${highLine.replace(/ /g, " L ")}`}
              fill="none"
              stroke={HIGH_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* ── Per-day dots + labels ── */}
            {data.map((day, i) => {
              const date = parseDateSafe(day.date);
              const isToday = new Date().toDateString() === date.toDateString();
              const dayLabel = isToday ? "Today" : DAY_LABELS[date.getDay()];
              const hx = xOf(i);
              const lx = xOf(i);
              const hy = yOf(day.tempMax);
              const ly = yOf(day.tempMin);

              // highlight today column
              return (
                <G key={i}>
                  {/* Today column highlight */}
                  {isToday && (
                    <Rect
                      x={hx - step / 2}
                      y={PAD_TOP}
                      width={step}
                      height={CHART_H}
                      fill={colors.primary}
                      opacity={0.05}
                      rx={4}
                    />
                  )}

                  {/* High dot */}
                  <Circle
                    cx={hx} cy={hy} r={3.5}
                    fill={HIGH_COLOR}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />

                  {/* Low dot */}
                  <Circle
                    cx={lx} cy={ly} r={3.5}
                    fill={LOW_COLOR}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />

                  {/* High temp label (above dot) */}
                  <SvgText
                    x={hx}
                    y={hy - 7}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_600SemiBold"}
                    fill={HIGH_COLOR}
                  >
                    {Math.round(day.tempMax)}°
                  </SvgText>

                  {/* Low temp label (below dot) */}
                  <SvgText
                    x={lx}
                    y={ly + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_600SemiBold"}
                    fill={LOW_COLOR}
                  >
                    {Math.round(day.tempMin)}°
                  </SvgText>

                  {/* Day label */}
                  <SvgText
                    x={hx}
                    y={PAD_TOP + CHART_H + PAD_BOT - 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_500Medium"}
                    fill={isToday ? colors.primary : colors.foreground}
                  >
                    {dayLabel}
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
          const highs = data.map((d) => d.tempMax);
          const lows = data.map((d) => d.tempMin);
          const avgHigh = highs.reduce((a, b) => a + b, 0) / highs.length;
          const avgLow = lows.reduce((a, b) => a + b, 0) / lows.length;
          const peakHigh = Math.max(...highs);
          const peakLow = Math.min(...lows);
          const heatDays = data.filter((d) => d.tempMax >= HEAT_LINE).length;
          const frostNights = data.filter((d) => d.tempMin <= FROST_LINE).length;
          return (
            <>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: HIGH_COLOR }]}>
                  {Math.round(avgHigh)}°
                </Text>
                <Text style={s.summaryLabel}>avg high</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: LOW_COLOR }]}>
                  {Math.round(avgLow)}°
                </Text>
                <Text style={s.summaryLabel}>avg low</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: HIGH_COLOR }]}>
                  {Math.round(peakHigh)}°
                </Text>
                <Text style={s.summaryLabel}>peak high</Text>
              </View>
              <View style={s.summaryItem}>
                {heatDays > 0 ? (
                  <>
                    <Text style={[s.summaryValue, { color: "#EF4444", fontSize: 14 }]}>
                      {heatDays}d ≥95°
                    </Text>
                    <Text style={s.summaryLabel}>heat stress</Text>
                  </>
                ) : frostNights > 0 ? (
                  <>
                    <Text style={[s.summaryValue, { color: FROST_COLOR, fontSize: 14 }]}>
                      {frostNights}n ≤32°
                    </Text>
                    <Text style={s.summaryLabel}>frost nights</Text>
                  </>
                ) : (
                  <>
                    <Text style={[s.summaryValue, { color: colors.primary, fontSize: 14 }]}>
                      {Math.round(peakLow)}°
                    </Text>
                    <Text style={s.summaryLabel}>low floor</Text>
                  </>
                )}
              </View>
            </>
          );
        })()}
      </View>
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
    },
    title: {
      fontSize: 13,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
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
  });
