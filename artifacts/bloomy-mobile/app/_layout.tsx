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
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
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
import { requestPermissions } from "@/utils/notifications";
import { tokenCache } from "@/utils/tokenCache";
import {
  useGetLocations,
  setBaseUrl,
  setAuthTokenGetter,
  registerPushToken,
  unregisterPushToken,
} from "@workspace/api-client-react";

function resolveApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, "");

  const replitDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!replitDomain) return "";

  const host = replitDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${host}`;
}

const BASE_URL = resolveApiBaseUrl();

const PUSH_TOKEN_STORAGE_KEY = "bloomy_push_token";

async function tryRegisterExpoToken(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;
    const projectId =
      (Constants.easConfig as any)?.projectId ??
      (Constants.expoConfig as any)?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    await registerPushToken({
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
  } catch {
    // Push token registration is best-effort; ignore all errors silently
  }
}

async function tryUnregisterExpoToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!token) return;
    await unregisterPushToken({ token });
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // Non-critical
  }
}

if (BASE_URL) {
  setBaseUrl(BASE_URL);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const clerkPublishableKey =
  (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    ""
  ).trim();
const clerkProxyUrl = (process.env.EXPO_PUBLIC_CLERK_PROXY_URL ?? "").trim();

// Keeps the stored Clerk token fresh for the background task (refreshed every 45 s)
function AuthTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isLoaded || !isSignedIn) return null;
      return getToken();
    });

    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded, isSignedIn]);

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

// Registers (on sign-in) and unregisters (on sign-out) the device Expo push token
// so the server can send weekly digest notifications to this device.
function PushTokenBridge() {
  const { isSignedIn } = useAuth();
  const prevSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const was = prevSignedIn.current;
    prevSignedIn.current = isSignedIn ?? false;

    if (isSignedIn && was !== true) {
      tryRegisterExpoToken();
    } else if (!isSignedIn && was === true) {
      tryUnregisterExpoToken();
    }
  }, [isSignedIn]);

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
        if (data?.screen === "farm" && data?.farmProfileId) {
          router.push(`/agriculture/${data.farmProfileId}` as any);
        } else if (data?.screen === "agriculture") {
          router.push("/(tabs)/agriculture");
        } else if (data?.screen === "alerts" || data?.alertId) {
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
      <PushTokenBridge />
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
        <Stack.Screen
          name="alerts/history"
          options={{ headerShown: false, presentation: "card" }}
        />
      </Stack>
    </>
  );
}

function MissingClerkConfigScreen() {
  return (
    <View style={missingConfigStyles.screen}>
      <Text style={missingConfigStyles.brand}>Bloomy</Text>
      <Text style={missingConfigStyles.title}>Clerk is not configured</Text>
      <Text style={missingConfigStyles.body}>
        Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before starting or building the
        mobile app.
      </Text>
    </View>
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

  if (!clerkPublishableKey) return <MissingClerkConfigScreen />;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      proxyUrl={clerkProxyUrl || undefined}
      tokenCache={tokenCache}
    >
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

const missingConfigStyles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#FAF8F5",
  },
  brand: {
    marginBottom: 24,
    fontFamily: "Outfit_700Bold",
    fontSize: 32,
    color: "#366441",
  },
  title: {
    marginBottom: 8,
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    color: "#232A23",
  },
  body: {
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#6E736E",
  },
});
