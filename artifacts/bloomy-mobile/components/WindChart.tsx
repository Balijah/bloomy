import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface DayData {
  date: Date | string;
  windSpeedMax: number;
  windGustMax: number;
}

interface Props {
  data: DayData[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Agricultural spray / field operation thresholds (mph)
const SPRAY_LIMIT = 15;   // above this: too windy for spraying
const ADVISORY = 35;       // high wind advisory
const DANGEROUS = 55;      // dangerous / destructive

function parseDateSafe(raw: Date | string): Date {
  const d = new Date(raw as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Returns a gradient id + fill color based on wind speed */
function windGradId(speed: number): string {
  if (speed >= ADVISORY) return "windRed";
  if (speed >= SPRAY_LIMIT) return "windAmber";
  return "windGreen";
}

function sprayLabel(speed: number): { text: string; color: string } {
  if (speed >= DANGEROUS) return { text: "Dangerous", color: "#EF4444" };
  if (speed >= ADVISORY)  return { text: "High wind",  color: "#F97316" };
  if (speed >= SPRAY_LIMIT) return { text: "Windy",    color: "#EAB308" };
  return { text: "Calm",                               color: "#22C55E" };
}

export default function WindChart({ data }: Props) {
  const colors = useColors();
  const s = styles(colors);
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  if (!data || data.length === 0) return null;

  const PAD_H = 10;
  const PAD_TOP = 16;
  const CHART_H = 130;
  const LABEL_H = 38;
  const SVG_H = PAD_TOP + CHART_H + LABEL_H;

  const maxSpeed = Math.max(SPRAY_LIMIT + 5, ...data.map((d) => d.windGustMax));
  const yScale = (v: number) =>
    PAD_TOP + CHART_H - (v / maxSpeed) * CHART_H;

  const innerW = containerWidth - PAD_H * 2;
  const barGroupW = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(4, barGroupW * 0.5);
  const gustW = Math.max(2, barW * 0.3);

  const thresholds = [
    { value: SPRAY_LIMIT, label: "15 mph — spray limit", color: "#EAB308" },
    { value: ADVISORY,    label: "35 mph — advisory",    color: "#F97316" },
  ].filter((t) => t.value <= maxSpeed * 1.05);

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>7-Day Wind Forecast</Text>
        <View style={s.legend}>
          <View style={[s.legendRect, { backgroundColor: "#22C55E" }]} />
          <Text style={s.legendText}>&lt;15</Text>
          <View style={[s.legendRect, { backgroundColor: "#EAB308", marginLeft: 6 }]} />
          <Text style={s.legendText}>15-35</Text>
          <View style={[s.legendRect, { backgroundColor: "#F97316", marginLeft: 6 }]} />
          <Text style={s.legendText}>35+ mph</Text>
        </View>
      </View>

      {/* Chart */}
      <View onLayout={onLayout}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={SVG_H}>
            <Defs>
              <LinearGradient id="windGreen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#4ADE80" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#86EFAC" stopOpacity="0.75" />
              </LinearGradient>
              <LinearGradient id="windAmber" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FACC15" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#FDE68A" stopOpacity="0.75" />
              </LinearGradient>
              <LinearGradient id="windRed" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#F97316" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#FED7AA" stopOpacity="0.75" />
              </LinearGradient>
            </Defs>

            {/* Threshold lines */}
            {thresholds.map((t) => {
              const ty = yScale(t.value);
              if (ty < PAD_TOP || ty > PAD_TOP + CHART_H) return null;
              return (
                <G key={t.value}>
                  <Line
                    x1={PAD_H} y1={ty}
                    x2={PAD_H + innerW} y2={ty}
                    stroke={t.color}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                    opacity={0.7}
                  />
                  <SvgText
                    x={PAD_H + innerW - 2}
                    y={ty - 3}
                    textAnchor="end"
                    fontSize={9}
                    fill={t.color}
                    fontFamily="Outfit_500Medium"
                    opacity={0.9}
                  >
                    {t.label}
                  </SvgText>
                </G>
              );
            })}

            {/* Baseline */}
            <Line
              x1={PAD_H} y1={PAD_TOP + CHART_H}
              x2={PAD_H + innerW} y2={PAD_TOP + CHART_H}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* Bars + gust markers + labels */}
            {data.map((day, i) => {
              const date = parseDateSafe(day.date);
              const isToday = new Date().toDateString() === date.toDateString();
              const dayLabel = isToday ? "Today" : DAY_LABELS[date.getDay()];
              const cx = PAD_H + i * barGroupW + barGroupW / 2;

              const speedH = Math.max(2, (day.windSpeedMax / maxSpeed) * CHART_H);
              const speedY = PAD_TOP + CHART_H - speedH;
              const gustY = yScale(day.windGustMax);

              const gradId = windGradId(day.windSpeedMax);
              const { color: labelColor } = sprayLabel(day.windSpeedMax);

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
                      opacity={0.05}
                      rx={4}
                    />
                  )}

                  {/* Wind speed bar */}
                  <Rect
                    x={cx - barW / 2}
                    y={speedY}
                    width={barW}
                    height={speedH}
                    rx={3}
                    ry={3}
                    fill={`url(#${gradId})`}
                  />

                  {/* Gust tick — thin bar above the speed bar */}
                  {day.windGustMax > day.windSpeedMax && (
                    <Rect
                      x={cx - gustW / 2}
                      y={gustY}
                      width={gustW}
                      height={Math.max(2, speedY - gustY)}
                      rx={1}
                      fill={labelColor}
                      opacity={0.45}
                    />
                  )}

                  {/* Speed label above bar */}
                  <SvgText
                    x={cx}
                    y={speedY - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_600SemiBold"}
                    fill={labelColor}
                  >
                    {Math.round(day.windSpeedMax)}
                  </SvgText>

                  {/* Gust label (only if meaningfully above speed) */}
                  {day.windGustMax - day.windSpeedMax >= 3 && (
                    <SvgText
                      x={cx}
                      y={gustY - 3}
                      textAnchor="middle"
                      fontSize={9}
                      fontFamily="Outfit_400Regular"
                      fill={colors.mutedForeground}
                      opacity={0.8}
                    >
                      ↑{Math.round(day.windGustMax)}
                    </SvgText>
                  )}

                  {/* Day label */}
                  <SvgText
                    x={cx}
                    y={PAD_TOP + CHART_H + 15}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_500Medium"}
                    fill={isToday ? colors.primary : colors.foreground}
                  >
                    {dayLabel}
                  </SvgText>

                  {/* Spray status */}
                  <SvgText
                    x={cx}
                    y={PAD_TOP + CHART_H + 28}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="Outfit_500Medium"
                    fill={sprayLabel(day.windSpeedMax).color}
                  >
                    {sprayLabel(day.windSpeedMax).text}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        )}
      </View>

      {/* Summary row */}
      <View style={s.summaryRow}>
        {(() => {
          const speeds = data.map((d) => d.windSpeedMax);
          const gusts = data.map((d) => d.windGustMax);
          const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
          const peakGust = Math.max(...gusts);
          const calmDays = data.filter((d) => d.windSpeedMax < SPRAY_LIMIT).length;
          const windyDays = data.filter((d) => d.windSpeedMax >= ADVISORY).length;

          return (
            <>
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{Math.round(avgSpeed)}</Text>
                <Text style={s.summaryLabel}>avg mph</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: peakGust >= ADVISORY ? "#F97316" : colors.foreground }]}>
                  {Math.round(peakGust)}
                </Text>
                <Text style={s.summaryLabel}>peak gust</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={[s.summaryValue, { color: "#22C55E" }]}>{calmDays}</Text>
                <Text style={s.summaryLabel}>spray day{calmDays !== 1 ? "s" : ""}</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: windyDays > 0 ? "#F97316" : colors.mutedForeground }]}>
                  {windyDays}
                </Text>
                <Text style={s.summaryLabel}>advisory day{windyDays !== 1 ? "s" : ""}</Text>
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
      gap: 3,
    },
    legendRect: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 10,
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
