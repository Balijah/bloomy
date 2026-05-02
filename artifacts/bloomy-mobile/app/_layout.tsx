import { ClerkProvider, useAuth } from "@clerk/expo";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import {
  BG_AUTH_TOKEN_KEY,
  BG_BASE_URL_KEY,
  clearBackgroundCredentials,
} from "@/utils/backgroundAlerts";
// Side-effect import: registers the TaskManager task at module level
import "@/utils/backgroundAlerts";
import { tokenCache } from "@/utils/tokenCache";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

if (BASE_URL) {
  setBaseUrl(BASE_URL);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Keep the background task's stored credentials fresh while the user is signed in.
  // Clerk tokens expire after ~60 s — we refresh every 45 s so the background task
  // always finds a token that is at most one window old (acceptable for a 15 min poll).
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (!isSignedIn) {
      clearBackgroundCredentials();
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    async function refreshStoredToken() {
      try {
        const token = await getToken();
        if (token && BASE_URL) {
          await Promise.all([
            AsyncStorage.setItem(BG_AUTH_TOKEN_KEY, token),
            AsyncStorage.setItem(BG_BASE_URL_KEY, BASE_URL),
          ]);
        }
      } catch {
        // getToken may throw if the session has ended
      }
    }

    refreshStoredToken();
    intervalRef.current = setInterval(refreshStoredToken, 45_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [getToken, isSignedIn]);

  return null;
}

function NotificationResponseHandler() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        if (data?.screen === "alerts" || data?.alertId) {
          router.push("/(tabs)/alerts");
        }
      }
    );
    return () => sub.remove();
  }, []);
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthTokenBridge />
      <NotificationResponseHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="agriculture/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <NotificationsProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </NotificationsProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
