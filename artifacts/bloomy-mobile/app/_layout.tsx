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
import { GeofencingProvider, useGeofencing } from "@/contexts/GeofencingContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
// Side-effect imports: register TaskManager tasks before any component renders
import "@/utils/backgroundAlerts";
import "@/utils/geofencing";
import {
  BG_AUTH_TOKEN_KEY,
  BG_BASE_URL_KEY,
  clearBackgroundCredentials,
} from "@/utils/backgroundAlerts";
import { tokenCache } from "@/utils/tokenCache";
import { useGetLocations } from "@workspace/api-client-react";
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

// Keeps the stored Clerk token fresh for the background task (refreshed every 45 s)
function AuthTokenBridge() {
  const { getToken, isSignedIn } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

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
        // Session may have ended
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

// Caches the user's farm locations to AsyncStorage and keeps geofences up to date
function LocationsCacheBridge() {
  const { data: locations } = useGetLocations();
  const { updateGeofences } = useGeofencing();

  useEffect(() => {
    if (!locations || Platform.OS === "web") return;
    updateGeofences(
      locations.map((l) => ({
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
      }))
    );
  }, [locations, updateGeofences]);

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
      <LocationsCacheBridge />
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
              <GeofencingProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </GeofencingProvider>
            </NotificationsProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
