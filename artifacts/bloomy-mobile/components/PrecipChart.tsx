import React, { useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  precipitation: number;
  precipitationProbability: number;
}

interface Props {
  data: DayData[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateSafe(raw: Date | string): Date {
  const d = new Date(raw as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function PrecipChart({ data }: Props) {
  const colors = useColors();
  const s = styles(colors);
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  const PADDING_H = 8;
  const CHART_H = 140;
  const LABEL_H = 36;
  const GRID_LINES = 3;
  const SVG_H = CHART_H + LABEL_H;

  const maxPrecip = Math.max(0.5, ...data.map((d) => d.precipitation));
  const yScale = (v: number) => CHART_H - (v / maxPrecip) * (CHART_H - 16);

  const barCount = data.length;
  const innerW = containerWidth - PADDING_H * 2;
  const barGroupW = barCount > 0 ? innerW / barCount : 0;
  const barW = Math.max(4, barGroupW * 0.55);

  const gridAmounts = [
    maxPrecip,
    maxPrecip * 0.67,
    maxPrecip * 0.33,
  ];

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>7-Day Precipitation</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: "#5B9BDE" }]} />
          <Text style={s.legendText}>Rain (in)</Text>
          <View style={[s.legendDot, { backgroundColor: colors.mutedForeground, marginLeft: 10 }]} />
          <Text style={s.legendText}>Chance %</Text>
        </View>
      </View>

      {/* Chart */}
      <View onLayout={onLayout} style={s.chartArea}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={SVG_H}>
            <Defs>
              <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#5B9BDE" stopOpacity="1" />
                <Stop offset="100%" stopColor="#A8CFF0" stopOpacity="0.85" />
              </LinearGradient>
              <LinearGradient id="barGradHeavy" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
                <Stop offset="100%" stopColor="#5B9BDE" stopOpacity="0.9" />
              </LinearGradient>
              <LinearGradient id="barGradDry" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#E2EAF4" stopOpacity="0.7" />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            {gridAmounts.map((amt, i) => {
              const y = yScale(amt);
              return (
                <G key={i}>
                  <Line
                    x1={PADDING_H}
                    y1={y}
                    x2={containerWidth - PADDING_H}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeDasharray="3,4"
                    opacity={0.6}
                  />
                  <SvgText
                    x={PADDING_H}
                    y={y - 3}
                    fontSize={9}
                    fill={colors.mutedForeground}
                    fontFamily="Outfit_400Regular"
                    opacity={0.8}
                  >
                    {amt.toFixed(2)}"
                  </SvgText>
                </G>
              );
            })}

            {/* Baseline */}
            <Line
              x1={PADDING_H}
              y1={CHART_H}
              x2={containerWidth - PADDING_H}
              y2={CHART_H}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* Bars + labels */}
            {data.map((day, i) => {
              const date = parseDateSafe(day.date);
              const dayLabel = DAY_LABELS[date.getDay()];
              const isToday = new Date().toDateString() === date.toDateString();
              const cx = PADDING_H + i * barGroupW + barGroupW / 2;
              const barH = Math.max(
                2,
                ((CHART_H - 16) * day.precipitation) / maxPrecip
              );
              const barX = cx - barW / 2;
              const barY = CHART_H - barH;

              const gradId =
                day.precipitation >= 1.5
                  ? "barGradHeavy"
                  : day.precipitation < 0.05
                  ? "barGradDry"
                  : "barGrad";

              return (
                <G key={i}>
                  {/* Bar */}
                  <Rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx={3}
                    ry={3}
                    fill={`url(#${gradId})`}
                  />

                  {/* Precipitation label above bar */}
                  {day.precipitation >= 0.01 && (
                    <SvgText
                      x={cx}
                      y={barY - 4}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily="Outfit_600SemiBold"
                      fill="#3A7AB5"
                    >
                      {day.precipitation.toFixed(2)}"
                    </SvgText>
                  )}

                  {/* Day label */}
                  <SvgText
                    x={cx}
                    y={CHART_H + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={isToday ? "Outfit_700Bold" : "Outfit_500Medium"}
                    fill={isToday ? colors.primary : colors.foreground}
                  >
                    {isToday ? "Today" : dayLabel}
                  </SvgText>

                  {/* Probability % */}
                  <SvgText
                    x={cx}
                    y={CHART_H + 27}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="Outfit_400Regular"
                    fill={colors.mutedForeground}
                  >
                    {day.precipitationProbability}%
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
          const total = data.reduce((s, d) => s + d.precipitation, 0);
          const wetDays = data.filter((d) => d.precipitation >= 0.1).length;
          const peakDay = data.reduce(
            (best, d) => (d.precipitation > best.precipitation ? d : best),
            data[0]
          );
          const peakDate = peakDay ? parseDateSafe(peakDay.date) : null;
          const peakLabel =
            peakDate?.toDateString() === new Date().toDateString()
              ? "Today"
              : peakDate
                ? DAY_LABELS[peakDate.getDay()]
                : "—";

          return (
            <>
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{total.toFixed(2)}"</Text>
                <Text style={s.summaryLabel}>7-day total</Text>
              </View>
              <View style={[s.summaryItem, s.summarySep]}>
                <Text style={s.summaryValue}>{wetDays}</Text>
                <Text style={s.summaryLabel}>
                  wet day{wetDays !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>
                  {peakDay?.precipitation.toFixed(2) ?? "—"}"
                </Text>
                <Text style={s.summaryLabel}>peak ({peakLabel})</Text>
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
    chartArea: {
      width: "100%",
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
