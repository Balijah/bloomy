/**
 * CropStageTracker — shows the current phenological growth stage based on
 * accumulated GDD, with a pipeline visualisation, within-stage progress, and
 * key agronomic tasks for the current stage.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  getCurrentStage,
  getStagesForCrop,
  type CropStage,
} from "@/lib/cropStages";

interface Props {
  cropType: string;
  accumulatedGDD: number | null | undefined;
  farmId: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortLabel(stage: CropStage): string {
  // First word, max 7 chars — keeps the dots from getting crowded
  const first = stage.name.split(/[\s&\/]/)[0];
  return first.length > 7 ? first.slice(0, 6) + "." : first;
}

function capitalize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function Pipeline({
  stages,
  currentIndex,
}: {
  stages: CropStage[];
  currentIndex: number;
}) {
  const colors = useColors();
  const s = pipelineStyles(colors);

  return (
    <View>
      {/* Dots + lines */}
      <View style={s.dotRow}>
        {stages.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          // Left half-line: green if this stage is current or done
          const leftActive = i <= currentIndex;
          // Right half-line: green only if this stage is already done
          const rightActive = i < currentIndex;

          return (
            <View key={stage.key} style={s.stageCol}>
              <View style={s.dotLineRow}>
                {/* Left half-line */}
                <View
                  style={[
                    s.halfLine,
                    {
                      backgroundColor:
                        i === 0
                          ? "transparent"
                          : leftActive
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                />
                {/* Dot */}
                <View
                  style={[
                    s.dot,
                    isCurrent && s.dotCurrent,
                    isCompleted && s.dotCompleted,
                    isFuture && s.dotFuture,
                  ]}
                >
                  {isCompleted && (
                    <Ionicons
                      name="checkmark"
                      size={7}
                      color="#fff"
                    />
                  )}
                  {isCurrent && (
                    <View style={s.dotInner} />
                  )}
                </View>
                {/* Right half-line */}
                <View
                  style={[
                    s.halfLine,
                    {
                      backgroundColor:
                        i === stages.length - 1
                          ? "transparent"
                          : rightActive
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                />
              </View>
              {/* Label */}
              <Text
                style={[
                  s.dotLabel,
                  isCurrent && { color: colors.primary, fontFamily: "Outfit_600SemiBold" },
                  isFuture && { color: colors.mutedForeground },
                  isCompleted && { color: colors.primary + "AA" },
                ]}
                numberOfLines={1}
              >
                {shortLabel(stage)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const pipelineStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    dotRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 4,
    },
    stageCol: {
      flex: 1,
      alignItems: "center",
    },
    dotLineRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    halfLine: {
      flex: 1,
      height: 2,
      borderRadius: 1,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.border,
    },
    dotCompleted: {
      backgroundColor: colors.primary,
    },
    dotCurrent: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.primary + "33",
    },
    dotFuture: {
      backgroundColor: colors.border,
    },
    dotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#fff",
    },
    dotLabel: {
      fontSize: 9,
      fontFamily: "Outfit_500Medium",
      color: colors.foreground,
      marginTop: 5,
      textAlign: "center",
    },
  });

// ── Progress bar ──────────────────────────────────────────────────────────────

function StageProgressBar({
  progress,
  accumulatedGDD,
  stageGddMin,
  stageGddMax,
}: {
  progress: number;
  accumulatedGDD: number;
  stageGddMin: number;
  stageGddMax: number;
}) {
  const colors = useColors();
  const pct = Math.round(progress * 100);
  const gddLeft = Math.max(0, stageGddMax - accumulatedGDD);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_500Medium",
            color: colors.mutedForeground,
          }}
        >
          {pct}% through this stage
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          {accumulatedGDD} / {stageGddMax} GDD
        </Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: colors.muted,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: colors.primary,
            borderRadius: 3,
          }}
        />
      </View>
      {gddLeft > 0 && (
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
          }}
        >
          ~{gddLeft} GDD until next stage
        </Text>
      )}
    </View>
  );
}

// ── Empty state (no planting date) ────────────────────────────────────────────

function EmptyState({
  cropType,
  farmId,
}: {
  cropType: string;
  farmId: number;
}) {
  const colors = useColors();
  const stages = getStagesForCrop(cropType);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 14,
      }}
    >
      {/* Preview pipeline — all muted */}
      <Pipeline stages={stages} currentIndex={-1} />

      <View style={{ alignItems: "center", gap: 6 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            textAlign: "center",
          }}
        >
          Set a planting date to track growth stages
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
          Bloomy will track your {capitalize(cropType)} through every phenological stage using GDD accumulation.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          backgroundColor: colors.primary + "15",
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.primary + "40",
          paddingVertical: 10,
          opacity: pressed ? 0.7 : 1,
        })}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/agriculture/edit/${farmId}` as any);
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: colors.primary,
          }}
        >
          Add Planting Date
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CropStageTracker({
  cropType,
  accumulatedGDD,
  farmId,
}: Props) {
  const colors = useColors();

  if (accumulatedGDD == null) {
    return <EmptyState cropType={cropType} farmId={farmId} />;
  }

  const result = getCurrentStage(cropType, accumulatedGDD);
  const { stages, currentIndex, current, stageProgress, gddToNextStage } = result;
  const isLastStage = currentIndex === stages.length - 1;

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
      {/* Pipeline */}
      <View style={{ padding: 16, paddingBottom: 12 }}>
        <Pipeline stages={stages} currentIndex={currentIndex} />
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* Current stage info */}
      <View style={{ padding: 16, gap: 10 }}>
        {/* Stage name + icon */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={current.icon as any}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Outfit_700Bold",
                color: colors.foreground,
                lineHeight: 20,
              }}
            >
              {current.name}
            </Text>
            {isLastStage && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Outfit_500Medium",
                    color: colors.primary,
                  }}
                >
                  Harvest window approaching
                </Text>
              </View>
            )}
          </View>
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Outfit_600SemiBold",
                color: colors.mutedForeground,
              }}
            >
              {accumulatedGDD} GDD
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Outfit_400Regular",
            color: colors.mutedForeground,
            lineHeight: 19,
          }}
        >
          {current.description}
        </Text>

        {/* Progress bar */}
        <StageProgressBar
          progress={stageProgress}
          accumulatedGDD={accumulatedGDD}
          stageGddMin={current.gddMin}
          stageGddMax={current.gddMax}
        />
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* Key tasks */}
      <View style={{ padding: 16, gap: 10 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_600SemiBold",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Key Tasks This Stage
        </Text>
        {current.keyTasks.map((task, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.primary + "15",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
                flexShrink: 0,
              }}
            >
              <Ionicons
                name="checkmark"
                size={12}
                color={colors.primary}
              />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: "Outfit_400Regular",
                color: colors.foreground,
                lineHeight: 19,
              }}
            >
              {task}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
