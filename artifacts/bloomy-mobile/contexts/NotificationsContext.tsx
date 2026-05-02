import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
  clearBadge,
  getPermissionStatus,
  requestPermissions,
} from "@/utils/notifications";
import {
  isBackgroundFetchRegistered,
  registerBackgroundFetch,
  unregisterBackgroundFetch,
} from "@/utils/backgroundAlerts";

const NOTIFICATIONS_ENABLED_KEY = "bloomy_notifications_enabled";

interface NotificationsContextValue {
  permission: string;
  enabled: boolean;
  backgroundFetchActive: boolean;
  requestAndEnable: () => Promise<void>;
  setEnabled: (val: boolean) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  permission: "undetermined",
  enabled: false,
  backgroundFetchActive: false,
  requestAndEnable: async () => {},
  setEnabled: async () => {},
});

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permission, setPermission] = useState("undetermined");
  const [enabled, setEnabledState] = useState(false);
  const [backgroundFetchActive, setBackgroundFetchActive] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    async function init() {
      const status = await getPermissionStatus();
      setPermission(status);

      const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      const shouldEnable = stored === "true" && status === "granted";
      setEnabledState(shouldEnable);

      // Sync background fetch registration with the stored enabled state
      if (shouldEnable) {
        await registerBackgroundFetch();
        setBackgroundFetchActive(await isBackgroundFetchRegistered());
      } else {
        await unregisterBackgroundFetch();
        setBackgroundFetchActive(false);
      }
    }
    init();
  }, []);

  // Clear badge when app comes to foreground
  useEffect(() => {
    if (Platform.OS === "web") return;

    function handleAppState(state: AppStateStatus) {
      if (state === "active") {
        clearBadge();
      }
    }

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, []);

  // Foreground notification listener (no extra action needed — handler set in notifications.ts)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  const requestAndEnable = useCallback(async () => {
    if (Platform.OS === "web") return;
    const granted = await requestPermissions();
    const newStatus = await getPermissionStatus();
    setPermission(newStatus);
    if (granted) {
      setEnabledState(true);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      await registerBackgroundFetch();
      setBackgroundFetchActive(await isBackgroundFetchRegistered());
    }
  }, []);

  const setEnabled = useCallback(async (val: boolean) => {
    setEnabledState(val);
    await AsyncStorage.setItem(
      NOTIFICATIONS_ENABLED_KEY,
      val ? "true" : "false"
    );
    if (val) {
      await registerBackgroundFetch();
      setBackgroundFetchActive(await isBackgroundFetchRegistered());
    } else {
      await unregisterBackgroundFetch();
      setBackgroundFetchActive(false);
      await clearBadge();
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ permission, enabled, backgroundFetchActive, requestAndEnable, setEnabled }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
