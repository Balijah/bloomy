/**
 * Background alert polling using expo-background-fetch + expo-task-manager.
 *
 * Strategy (dual-path):
 *  1. Try a live API call with the token most recently stored by AuthTokenBridge.
 *  2. If the token is expired / network fails, fall back to the alert list cached
 *     in AsyncStorage by the Alerts screen after each foreground fetch.
 *
 * This means the user always gets a badge reminder for known-unread alerts even
 * when the app has been closed for longer than Clerk's 60-second JWT window.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

export const BACKGROUND_FETCH_TASK = "BLOOMY_BACKGROUND_ALERTS";

// Keys shared with the rest of the app
export const BG_AUTH_TOKEN_KEY = "bloomy_bg_auth_token";
export const BG_BASE_URL_KEY = "bloomy_bg_base_url";
export const CACHED_ALERTS_KEY = "bloomy_cached_alerts";
const SEEN_IDS_KEY = "bloomy_seen_alert_ids";

interface AlertItem {
  id: number;
  title: string;
  message: string;
  severity?: string | null;
  alertType?: string;
  isRead: boolean;
  farmProfileId?: number | null;
}

const SEVERITY_PRIORITY: Record<string, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
};

async function fireNotificationsForAlerts(alerts: AlertItem[]): Promise<void> {
  const unread = alerts.filter((a) => !a.isRead);
  if (unread.length === 0) return;

  const seenRaw = await AsyncStorage.getItem(SEEN_IDS_KEY);
  const seenIds = new Set<number>(seenRaw ? JSON.parse(seenRaw) : []);
  const newAlerts = unread.filter((a) => !seenIds.has(a.id));
  if (newAlerts.length === 0) return;

  const sorted = [...newAlerts].sort(
    (a, b) =>
      (SEVERITY_PRIORITY[b.severity ?? "minor"] ?? 1) -
      (SEVERITY_PRIORITY[a.severity ?? "minor"] ?? 1)
  );

  if (sorted.length === 1) {
    const single = sorted[0];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: single.title,
        body: single.message.slice(0, 140),
        data: {
          alertId: single.id,
          screen: single.farmProfileId ? "farm" : "alerts",
          ...(single.farmProfileId ? { farmProfileId: single.farmProfileId } : {}),
        },
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

  // Mark all current IDs as seen so we don't re-fire next cycle
  await AsyncStorage.setItem(
    SEEN_IDS_KEY,
    JSON.stringify(alerts.map((a) => a.id))
  );
}

// ─── Task definition ─────────────────────────────────────────────────────────
// Must be called at module level (not inside a component or function).
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const [token, baseUrl, cachedRaw] = await Promise.all([
      AsyncStorage.getItem(BG_AUTH_TOKEN_KEY),
      AsyncStorage.getItem(BG_BASE_URL_KEY),
      AsyncStorage.getItem(CACHED_ALERTS_KEY),
    ]);

    let alerts: AlertItem[] | null = null;

    // Path 1: live API fetch with stored token
    if (token && baseUrl) {
      try {
        const resp = await fetch(`${baseUrl}/api/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (resp.ok) {
          const data = await resp.json();
          alerts = Array.isArray(data) ? data : null;
          // Refresh the cache with the fresh data
          if (alerts) {
            await AsyncStorage.setItem(
              CACHED_ALERTS_KEY,
              JSON.stringify(alerts)
            );
          }
        }
      } catch {
        // Network error or token expired — fall through to cache
      }
    }

    // Path 2: fall back to locally cached alerts
    if (!alerts && cachedRaw) {
      try {
        alerts = JSON.parse(cachedRaw);
      } catch {
        alerts = null;
      }
    }

    if (!alerts || alerts.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await fireNotificationsForAlerts(alerts);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helpers ────────────────────────────────────────────────────

/** Register the background task. Safe to call multiple times. */
export async function registerBackgroundFetch(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_FETCH_TASK
    );
    if (!alreadyRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false, // keep running after app is terminated (Android)
        startOnBoot: true, // restart on device reboot (Android)
      });
    }
  } catch {
    // Background fetch may not be available in Expo Go
  }
}

/** Unregister the background task. */
export async function unregisterBackgroundFetch(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_FETCH_TASK
    );
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    }
  } catch {
    // ignore
  }
}

/** Returns true if the background task is currently registered. */
export async function isBackgroundFetchRegistered(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  } catch {
    return false;
  }
}

/** Persist the auth token + base URL so the background task can use them. */
export async function saveBackgroundCredentials(
  token: string,
  baseUrl: string
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(BG_AUTH_TOKEN_KEY, token),
    AsyncStorage.setItem(BG_BASE_URL_KEY, baseUrl),
  ]);
}

/** Clear credentials on sign-out. */
export async function clearBackgroundCredentials(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(BG_AUTH_TOKEN_KEY),
    AsyncStorage.removeItem(BG_BASE_URL_KEY),
  ]);
}
