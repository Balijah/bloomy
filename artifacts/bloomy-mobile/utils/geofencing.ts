/**
 * Geofencing utility — fires a local notification when the user enters
 * one of their saved farm locations while there are active weather alerts.
 *
 * TaskManager.defineTask MUST be called at module-top (before any React
 * component renders), so this file is imported as a side-effect in _layout.tsx.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { CACHED_ALERTS_KEY } from "./backgroundAlerts";

export const GEOFENCING_TASK = "BLOOMY_GEOFENCING";
export const CACHED_LOCATIONS_KEY = "bloomy_cached_locations";
export const GEOFENCING_ENABLED_KEY = "bloomy_geofencing_enabled";

// Region identifier format: "bloomy|{id}|{name}"
const ID_PREFIX = "bloomy|";

function makeIdentifier(id: number, name: string) {
  return `${ID_PREFIX}${id}|${name}`;
}

function parseIdentifier(identifier: string): {
  id: number;
  name: string;
} | null {
  if (!identifier.startsWith(ID_PREFIX)) return null;
  const rest = identifier.slice(ID_PREFIX.length);
  const sep = rest.indexOf("|");
  if (sep === -1) return null;
  return { id: Number(rest.slice(0, sep)), name: rest.slice(sep + 1) };
}

// ─── Background task ──────────────────────────────────────────────────────────
// Defined at module level — required by expo-task-manager.
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error || !data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  // Only trigger on farm entry
  if (eventType !== Location.GeofencingEventType.Enter) return;

  const parsed = parseIdentifier(region.identifier ?? "");
  const locationName = parsed?.name ?? "your farm";

  // Read cached alerts
  const cachedRaw = await AsyncStorage.getItem(CACHED_ALERTS_KEY);
  if (!cachedRaw) return;

  let alerts: { id: number; isRead: boolean; title: string; severity?: string | null }[] = [];
  try {
    alerts = JSON.parse(cachedRaw);
  } catch {
    return;
  }

  const unread = alerts.filter((a) => !a.isRead);
  if (unread.length === 0) return;

  const body =
    unread.length === 1
      ? `Active alert: ${unread[0].title}`
      : `${unread.length} active weather alerts need your attention.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `You've arrived at ${locationName}`,
      body,
      data: { screen: "alerts" },
      sound: "default",
      badge: unread.length,
    },
    trigger: null,
  });
});

// ─── Permission helpers ───────────────────────────────────────────────────────

export type GeofencingPermissionStatus =
  | "unavailable"
  | "undetermined"
  | "foreground_only"
  | "granted"
  | "denied";

export async function getGeofencingPermissionStatus(): Promise<GeofencingPermissionStatus> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      return fg.status === "undetermined" ? "undetermined" : "denied";
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      return bg.status === "undetermined" ? "foreground_only" : "foreground_only";
    }
    return "granted";
  } catch {
    return "unavailable";
  }
}

/**
 * Requests foreground and then background location permissions.
 * Returns the final permission status.
 */
export async function requestGeofencingPermissions(): Promise<GeofencingPermissionStatus> {
  if (Platform.OS === "web") return "unavailable";
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return "denied";

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") return "foreground_only";

    return "granted";
  } catch {
    return "unavailable";
  }
}

// ─── Registration helpers ────────────────────────────────────────────────────

export interface FarmLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

/** Geofence radius in metres — 5 km covers typical farm footprint. */
const RADIUS_M = 5_000;

/**
 * Start geofencing for the given locations.
 * Stops any previously registered geofences first.
 */
export async function startGeofencing(locations: FarmLocation[]): Promise<void> {
  if (Platform.OS === "web" || locations.length === 0) return;
  try {
    // Stop existing task before re-registering (avoids duplicate regions)
    const running = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
    if (running) {
      await Location.stopGeofencingAsync(GEOFENCING_TASK);
    }

    const regions: Location.LocationRegion[] = locations.map((loc) => ({
      identifier: makeIdentifier(loc.id, loc.name),
      latitude: loc.lat,
      longitude: loc.lng,
      radius: RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    await Location.startGeofencingAsync(GEOFENCING_TASK, regions);
  } catch {
    // Silently ignore — may fail in Expo Go without a full dev build
  }
}

/** Stop geofencing. */
export async function stopGeofencing(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const running = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
    if (running) {
      await Location.stopGeofencingAsync(GEOFENCING_TASK);
    }
  } catch {
    // ignore
  }
}

/** Returns true if geofencing is currently active. */
export async function isGeofencingStarted(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
  } catch {
    return false;
  }
}
