import {
  useGetAlerts,
  useMarkAlertRead,
  useDeleteAlert,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notifyNewAlerts } from "@/utils/notifications";
import { format, parseISO } from "date-fns";

const ALERT_TYPE_ICONS: Record<string, string> = {
  frost: "thermometer-outline",
  hard_freeze: "snow-outline",
  extreme_heat: "flame-outline",
  heat_stress: "sunny-outline",
  heavy_precipitation: "rainy-outline",
  flash_flood: "water-outline",
  drought: "leaf-outline",
  high_wind: "speedometer-outline",
  hail: "cloudy-outline",
  harvest_disruption: "cloud-offline-outline",
  late_season_frost: "thermometer-outline",
  winter_storm: "snow-outline",
};

const SEVERITY_COLORS: Record<string, string> = {
  extreme: "#F23030",
  severe: "#F07030",
  moderate: "#EAAC30",
  minor: "#5B9BDE",
};

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { enabled: notificationsEnabled } = useNotifications();

  const { data: alerts, isLoading, refetch, isRefetching } = useGetAlerts({});
  const markRead = useMarkAlertRead();
  const deleteAlert = useDeleteAlert();

  // Fire notifications when new unread alerts arrive
  const prevAlertCountRef = useRef<number>(-1);
  useEffect(() => {
    if (!alerts || !notificationsEnabled || Platform.OS === "web") return;
    const unreadCount = alerts.filter((a) => !a.isRead).length;
    // Only notify when count increases (new alerts arrived)
    if (
      prevAlertCountRef.current >= 0 &&
      unreadCount > prevAlertCountRef.current
    ) {
      notifyNewAlerts(alerts as Parameters<typeof notifyNewAlerts>[0]);
    }
    prevAlertCountRef.current = unreadCount;
  }, [alerts, notificationsEnabled]);

  // Notify on initial load when there are unread alerts (app was opened from scratch)
  const hasNotifiedInitial = useRef(false);
  useEffect(() => {
    if (
      !alerts ||
      hasNotifiedInitial.current ||
      !notificationsEnabled ||
      Platform.OS === "web"
    )
      return;
    hasNotifiedInitial.current = true;
    notifyNewAlerts(alerts as Parameters<typeof notifyNewAlerts>[0]);
  }, [alerts, notificationsEnabled]);

  const unread = alerts?.filter((a) => !a.isRead) ?? [];
  const read = alerts?.filter((a) => a.isRead) ?? [];

  function handleMarkRead(id: number) {
    Haptics.selectionAsync();
    markRead.mutate({ id });
  }

  function handleDelete(id: number) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteAlert.mutate({ id });
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const all = [...unread, ...read];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s(colors).header, { paddingTop: topPad + 16 }]}>
        <Text style={s(colors).headerTitle}>Alerts</Text>
        {unread.length > 0 && (
          <View style={s(colors).badge}>
            <Text style={s(colors).badgeText}>{unread.length}</Text>
          </View>
        )}
        {notificationsEnabled && Platform.OS !== "web" && (
          <View style={s(colors).notifPill}>
            <Ionicons name="notifications" size={12} color={colors.primary} />
            <Text style={s(colors).notifPillText}>On</Text>
          </View>
        )}
      </View>

      <FlatList
        data={all}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={all.length > 0}
        contentContainerStyle={[
          s(colors).listContent,
          {
            paddingBottom:
              Platform.OS === "web" ? 84 + 16 : insets.bottom + 80,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={s(colors).empty}>
            <Ionicons
              name="checkmark-circle-outline"
              size={56}
              color={colors.primary}
            />
            <Text style={s(colors).emptyTitle}>All clear</Text>
            <Text style={s(colors).emptyText}>
              No active weather alerts for your locations.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const iconName =
            ALERT_TYPE_ICONS[item.alertType ?? ""] ?? "warning-outline";
          const severityColor =
            SEVERITY_COLORS[item.severity ?? "minor"] ?? SEVERITY_COLORS.minor;
          return (
            <View
              style={[
                s(colors).alertCard,
                item.isRead && s(colors).alertCardRead,
              ]}
              testID={`alert-card-${item.id}`}
            >
              <View
                style={[
                  s(colors).alertIcon,
                  { backgroundColor: severityColor + "22" },
                ]}
              >
                <Ionicons
                  name={iconName as any}
                  size={22}
                  color={severityColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s(colors).alertTop}>
                  <Text
                    style={[
                      s(colors).alertTitle,
                      item.isRead && s(colors).alertTitleRead,
                    ]}
                  >
                    {item.title}
                  </Text>
                  {!item.isRead && (
                    <View
                      style={[
                        s(colors).unreadDot,
                        { backgroundColor: severityColor },
                      ]}
                    />
                  )}
                </View>
                <Text style={s(colors).alertMsg} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={s(colors).alertTime}>
                  {format(
                    parseISO(item.createdAt as unknown as string),
                    "MMM d · h:mm a"
                  )}
                </Text>
              </View>
              <View style={s(colors).alertActions}>
                {!item.isRead && (
                  <Pressable
                    style={({ pressed }) => [
                      s(colors).actionBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleMarkRead(item.id)}
                    testID={`button-mark-read-${item.id}`}
                  >
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    s(colors).actionBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleDelete(item.id)}
                  testID={`button-delete-alert-${item.id}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    badge: {
      backgroundColor: colors.destructive,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      marginBottom: 4,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: "Outfit_700Bold",
      color: "#ffffff",
    },
    notifPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginBottom: 4,
    },
    notifPillText: {
      fontSize: 11,
      fontFamily: "Outfit_500Medium",
      color: colors.primary,
    },
    listContent: { padding: 16, gap: 10 },
    alertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    alertCardRead: { opacity: 0.65 },
    alertIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    alertTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    alertTitle: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    alertTitleRead: {
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    alertMsg: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    alertTime: {
      fontSize: 11,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 6,
    },
    alertActions: { flexDirection: "column", gap: 4 },
    actionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 22,
      fontFamily: "Outfit_600SemiBold",
      color: colors.foreground,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
    },
  });
