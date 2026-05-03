import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Alert } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const RISK_TYPE_LABELS: Record<string, string> = {
  frost: "Frost",
  heat_stress: "Heat Stress",
  drought: "Drought",
  harvest_disruption: "Harvest Disruption",
};

const RISK_TYPE_ICONS: Record<string, string> = {
  frost: "snow-outline",
  heat_stress: "thermometer-outline",
  drought: "warning-outline",
  harvest_disruption: "thunderstorm-outline",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#F23030",
  warning: "#F07030",
  watch: "#EAAC30",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  warning: "High",
  watch: "Moderate",
};

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

interface RiskHistoryCardProps {
  history: Alert[];
  isLoading?: boolean;
}

const INITIAL_VISIBLE = 5;

export default function RiskHistoryCard({ history, isLoading }: RiskHistoryCardProps) {
  const colors = useColors();
  const s = styles(colors);
  const [expanded, setExpanded] = useState(false);

  const RISK_TYPES = ["frost", "heat_stress", "drought", "harvest_disruption"];
  const riskHistory = history.filter((a) => RISK_TYPES.includes(a.type));

  const visible = expanded ? riskHistory : riskHistory.slice(0, INITIAL_VISIBLE);
  const hasMore = riskHistory.length > INITIAL_VISIBLE;

  if (isLoading) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
          <Text style={s.cardTitle}>Risk History</Text>
        </View>
        <Text style={s.emptyText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="time-outline" size={18} color={colors.foreground} />
        <Text style={s.cardTitle}>Risk History</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{riskHistory.length}</Text>
        </View>
      </View>

      {riskHistory.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons
            name="checkmark-circle-outline"
            size={32}
            color={colors.primary}
          />
          <Text style={s.emptyTitle}>No risk events recorded</Text>
          <Text style={s.emptySubtitle}>
            Frost, heat, and drought alerts for this farm will appear here as
            they occur.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.list}>
            {visible.map((alert, i) => {
              const color =
                SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.watch;
              const icon =
                RISK_TYPE_ICONS[alert.type] ?? "warning-outline";
              const typeLabel =
                RISK_TYPE_LABELS[alert.type] ?? alert.type;
              const severityLabel =
                SEVERITY_LABELS[alert.severity] ?? alert.severity;
              const relDate = formatRelativeDate(
                typeof alert.triggeredAt === "string"
                  ? alert.triggeredAt
                  : new Date(alert.triggeredAt).toISOString()
              );
              const isLast = i === visible.length - 1;

              return (
                <View
                  key={alert.id}
                  style={[s.row, !isLast && s.rowBorder]}
                  testID={`risk-history-row-${alert.id}`}
                >
                  {/* left color stripe + icon */}
                  <View
                    style={[
                      s.iconWrap,
                      { backgroundColor: color + "18" },
                    ]}
                  >
                    <Ionicons
                      name={icon as any}
                      size={16}
                      color={color}
                    />
                  </View>

                  {/* main content */}
                  <View style={s.rowContent}>
                    <View style={s.rowTop}>
                      <Text style={s.typeLabel} numberOfLines={1}>
                        {typeLabel}
                      </Text>
                      <View
                        style={[
                          s.severityBadge,
                          { backgroundColor: color + "22" },
                        ]}
                      >
                        <Text style={[s.severityText, { color }]}>
                          {severityLabel}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={s.messageText}
                      numberOfLines={2}
                    >
                      {alert.message}
                    </Text>
                    <Text style={s.dateText}>{relDate}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {hasMore && (
            <Pressable
              style={({ pressed }) => [
                s.showMoreBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setExpanded((e) => !e)}
              testID="button-risk-history-toggle"
            >
              <Text style={s.showMoreText}>
                {expanded
                  ? "Show less"
                  : `Show ${riskHistory.length - INITIAL_VISIBLE} more`}
              </Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.primary}
              />
            </Pressable>
          )}
        </>
      )}
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
      overflow: "hidden",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cardTitle: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    countBadge: {
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    countText: {
      fontSize: 12,
      fontFamily: "Outfit_600SemiBold",
      color: colors.mutedForeground,
    },
    list: {
      paddingHorizontal: 14,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 13,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
      flexShrink: 0,
    },
    rowContent: {
      flex: 1,
      gap: 3,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    typeLabel: {
      fontSize: 14,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    severityBadge: {
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    severityText: {
      fontSize: 11,
      fontFamily: "Outfit_600SemiBold",
    },
    messageText: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    dateText: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 1,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 19,
    },
    emptyText: {
      padding: 16,
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    showMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    showMoreText: {
      fontSize: 13,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primary,
    },
  });
