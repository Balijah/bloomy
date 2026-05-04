import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Alert } from "@workspace/api-client-react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const LAST_NOTIFIED_KEY = "bloomy_last_notified_at";
const SEEN_IDS_KEY = "bloomy_seen_alert_ids";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function getPermissionStatus(): Promise<string> {
  if (Platform.OS === "web") return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Silently ignore on web/unsupported platforms
  }
}

export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

type AlertItem = Pick<
  Alert,
  "id" | "title" | "message" | "severity" | "type" | "isRead" | "triggeredAt"
>;

const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 4,
  extreme: 4,
  warning: 3,
  severe: 3,
  watch: 2,
  moderate: 2,
  minor: 1,
};

export async function notifyNewAlerts(alerts: AlertItem[]): Promise<void> {
  if (Platform.OS === "web") return;

  const unread = alerts.filter((a) => !a.isRead);
  if (unread.length === 0) {
    await clearBadge();
    return;
  }

  // Load seen IDs
  const seenRaw = await AsyncStorage.getItem(SEEN_IDS_KEY);
  const seenIds = new Set<number>(seenRaw ? JSON.parse(seenRaw) : []);

  const newAlerts = unread.filter((a) => !seenIds.has(a.id));
  if (newAlerts.length === 0) {
    await setBadgeCount(unread.length);
    return;
  }

  // Sort by severity (highest first)
  const sorted = [...newAlerts].sort(
    (a, b) =>
      (SEVERITY_PRIORITY[b.severity ?? "watch"] ?? 1) -
      (SEVERITY_PRIORITY[a.severity ?? "watch"] ?? 1)
  );

  if (sorted.length === 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: sorted[0].title,
        body: sorted[0].message.slice(0, 140),
        data: { alertId: sorted[0].id, screen: "alerts" },
        sound: "default",
        badge: unread.length,
      },
      trigger: null,
    });
  } else {
    const topTitles = sorted
      .slice(0, 3)
      .map((a) => a.title)
      .join(" · ");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${sorted.length} New Weather Alerts`,
        body: topTitles,
        data: { screen: "alerts" },
        sound: "default",
        badge: unread.length,
      },
      trigger: null,
    });
  }

  // Mark all current IDs as seen
  const allIds = alerts.map((a) => a.id);
  await AsyncStorage.setItem(SEEN_IDS_KEY, JSON.stringify(allIds));
  await AsyncStorage.setItem(LAST_NOTIFIED_KEY, new Date().toISOString());
}

export async function resetSeenAlerts(): Promise<void> {
  await AsyncStorage.removeItem(SEEN_IDS_KEY);
  await AsyncStorage.removeItem(LAST_NOTIFIED_KEY);
}
