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

const NOTIFICATIONS_ENABLED_KEY = "bloomy_notifications_enabled";

interface NotificationsContextValue {
  permission: string;
  enabled: boolean;
  requestAndEnable: () => Promise<void>;
  setEnabled: (val: boolean) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  permission: "undetermined",
  enabled: false,
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

  useEffect(() => {
    if (Platform.OS === "web") return;

    async function init() {
      const status = await getPermissionStatus();
      setPermission(status);

      const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      const shouldEnable = stored === "true" && status === "granted";
      setEnabledState(shouldEnable);
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

  // Listen for notification taps (handled in _layout.tsx via router)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is in foreground — no extra action needed
    });
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
    }
  }, []);

  const setEnabled = useCallback(async (val: boolean) => {
    setEnabledState(val);
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, val ? "true" : "false");
    if (!val) {
      await clearBadge();
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ permission, enabled, requestAndEnable, setEnabled }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
