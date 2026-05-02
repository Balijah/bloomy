import {
  useGetMe,
  useGetCurrentSubscription,
  useGetLocations,
  useCreateLocation,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useGeofencing } from "@/contexts/GeofencingContext";

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "#6E736E" },
  grower: { label: "Grower", color: "#366441" },
  grower_pro: { label: "Grower Pro", color: "#CC9133" },
};

function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  testID,
  right,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        rowStyles(colors).row,
        pressed && onPress && { opacity: 0.7 },
      ]}
      onPress={onPress}
      disabled={!onPress && !right}
      testID={testID}
    >
      <View
        style={[
          rowStyles(colors).icon,
          destructive && { backgroundColor: colors.destructive + "22" },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <Text
        style={[
          rowStyles(colors).label,
          destructive && { color: colors.destructive },
        ]}
      >
        {label}
      </Text>
      {right ?? (
        <>
          {value && <Text style={rowStyles(colors).value}>{value}</Text>}
          {onPress && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.mutedForeground}
            />
          )}
        </>
      )}
    </Pressable>
  );
}

function rowStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Outfit_500Medium",
      color: colors.foreground,
    },
    value: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginRight: 4,
    },
  });
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontSize: 12,
        fontFamily: "Outfit_600SemiBold",
        color: colors.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginHorizontal: 20,
      }}
    />
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { signOut } = useAuth();
  const {
    permission,
    enabled,
    backgroundFetchActive,
    requestAndEnable,
    setEnabled,
  } = useNotifications();
  const {
    locationPermission,
    geofencingEnabled,
    geofencingActive,
    requestLocationPermission,
    setGeofencingEnabled,
  } = useGeofencing();

  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: sub } = useGetCurrentSubscription();
  const { data: locations } = useGetLocations();
  const createLocation = useCreateLocation();

  const [addingLocation, setAddingLocation] = useState(false);
  const [locName, setLocName] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");

  const tier = user?.subscriptionTier ?? "free";
  const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.free;

  const notifUnavailable = Platform.OS === "web";
  const notifDenied = permission === "denied";

  async function handleToggleNotifications(val: boolean) {
    if (notifUnavailable) return;
    if (val && permission !== "granted") {
      await requestAndEnable();
      return;
    }
    Haptics.selectionAsync();
    await setEnabled(val);
  }

  async function handleToggleGeofencing(val: boolean) {
    if (notifUnavailable) return;
    Haptics.selectionAsync();
    if (val && locationPermission === "denied") {
      Alert.alert(
        "Location Required",
        "Background location access is blocked. Open Settings to allow Bloomy to use location in the background.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    await setGeofencingEnabled(val);
  }

  async function handleOpenSettings() {
    if (Platform.OS !== "web") {
      await Linking.openSettings();
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
        },
      },
    ]);
  }

  async function handleAddLocation() {
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    if (!locName.trim() || isNaN(lat) || isNaN(lng)) {
      Alert.alert(
        "Invalid input",
        "Please enter a name, latitude, and longitude."
      );
      return;
    }
    createLocation.mutate(
      {
        data: {
          name: locName.trim(),
          lat,
          lng,
          isDefault: !locations?.length,
        },
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setAddingLocation(false);
          setLocName("");
          setLocLat("");
          setLocLng("");
        },
        onError: () => {
          Alert.alert("Error", "Failed to add location.");
        },
      }
    );
  }

  if (isUserLoading) {
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

  // Geofencing status label + colour
  const geofenceStatusText = (() => {
    if (notifUnavailable) return null;
    if (!enabled) return null;
    if (locationPermission === "denied") return "Location access blocked";
    if (locationPermission === "foreground_only")
      return "Background location required";
    if (geofencingActive) return "Active · notifies on farm arrival";
    if (geofencingEnabled) return "Starting…";
    return null;
  })();

  const geofenceStatusColor =
    geofencingActive ? colors.primary : colors.mutedForeground;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: Platform.OS === "web" ? 84 + 16 : insets.bottom + 80,
      }}
    >
      {/* Profile header */}
      <View style={[s(colors).profileHeader, { paddingTop: topPad + 16 }]}>
        <View style={s(colors).avatar}>
          <Text style={s(colors).avatarText}>
            {user?.firstName?.[0]?.toUpperCase() ??
              user?.email?.[0]?.toUpperCase() ??
              "G"}
          </Text>
        </View>
        <View>
          <Text style={s(colors).profileName}>
            {user?.firstName
              ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
              : "Grower"}
          </Text>
          <Text style={s(colors).profileEmail}>{user?.email}</Text>
          <View
            style={[
              s(colors).tierBadge,
              { borderColor: tierInfo.color + "55" },
            ]}
          >
            <View
              style={[s(colors).tierDot, { backgroundColor: tierInfo.color }]}
            />
            <Text style={[s(colors).tierText, { color: tierInfo.color }]}>
              {tierInfo.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Notifications */}
      <SectionHeader title="Notifications" />
      <View style={s(colors).sectionCard}>
        {notifUnavailable ? (
          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            value="Not available on web"
            testID="row-notifications-web"
          />
        ) : notifDenied ? (
          <>
            <SettingRow
              icon="notifications-off-outline"
              label="Push Notifications"
              value="Blocked"
              onPress={handleOpenSettings}
              testID="row-notifications-denied"
            />
            <Divider />
            <Pressable
              style={({ pressed }) => [
                s(colors).openSettingsBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleOpenSettings}
              testID="button-open-settings"
            >
              <Ionicons
                name="settings-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={s(colors).openSettingsBtnText}>
                Open device settings to allow notifications
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Weather alerts toggle */}
            <SettingRow
              icon={enabled ? "notifications" : "notifications-outline"}
              label="Weather Alerts"
              testID="row-notifications-toggle"
              right={
                <Switch
                  value={enabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{
                    false: colors.muted,
                    true: colors.primary + "88",
                  }}
                  thumbColor={enabled ? colors.primary : colors.mutedForeground}
                  testID="switch-notifications"
                />
              }
            />

            {enabled && (
              <>
                {/* Background poll status */}
                <Divider />
                <View style={s(colors).statusRow}>
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={
                      backgroundFetchActive
                        ? colors.primary
                        : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      s(colors).statusText,
                      {
                        color: backgroundFetchActive
                          ? colors.primary
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {backgroundFetchActive
                      ? "Background polling active · checks every 15 min"
                      : "Background polling unavailable in Expo Go"}
                  </Text>
                </View>

                {/* Farm arrival alerts toggle */}
                <Divider />
                <SettingRow
                  icon={geofencingEnabled ? "navigate" : "navigate-outline"}
                  label="Farm Arrival Alerts"
                  testID="row-geofencing-toggle"
                  right={
                    <Switch
                      value={geofencingEnabled}
                      onValueChange={handleToggleGeofencing}
                      trackColor={{
                        false: colors.muted,
                        true: colors.primary + "88",
                      }}
                      thumbColor={
                        geofencingEnabled
                          ? colors.primary
                          : colors.mutedForeground
                      }
                      testID="switch-geofencing"
                    />
                  }
                />

                {/* Geofencing permission / status info */}
                {geofencingEnabled && (
                  <>
                    {locationPermission === "foreground_only" && (
                      <>
                        <Divider />
                        <Pressable
                          style={({ pressed }) => [
                            s(colors).openSettingsBtn,
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={handleOpenSettings}
                          testID="button-open-settings-location"
                        >
                          <Ionicons
                            name="settings-outline"
                            size={15}
                            color={colors.primary}
                          />
                          <Text style={s(colors).openSettingsBtnText}>
                            Allow "Always" location access in Settings for
                            background alerts
                          </Text>
                        </Pressable>
                      </>
                    )}

                    {locationPermission === "undetermined" && (
                      <>
                        <Divider />
                        <Pressable
                          style={({ pressed }) => [
                            s(colors).enableNotifBtn,
                            { margin: 12 },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={requestLocationPermission}
                          testID="button-request-location"
                        >
                          <Ionicons
                            name="location-outline"
                            size={18}
                            color={colors.primaryForeground}
                          />
                          <Text style={s(colors).enableNotifBtnText}>
                            Allow Background Location
                          </Text>
                        </Pressable>
                      </>
                    )}

                    {geofenceStatusText && (
                      <>
                        <Divider />
                        <View style={s(colors).statusRow}>
                          <Ionicons
                            name={
                              geofencingActive
                                ? "radio-button-on-outline"
                                : "radio-button-off-outline"
                            }
                            size={15}
                            color={geofenceStatusColor}
                          />
                          <Text
                            style={[
                              s(colors).statusText,
                              { color: geofenceStatusColor },
                            ]}
                          >
                            {geofenceStatusText}
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}

                {!geofencingEnabled && (
                  <>
                    <Divider />
                    <View style={s(colors).notifInfoRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={colors.mutedForeground}
                      />
                      <Text style={s(colors).notifInfoText}>
                        Enable Farm Arrival Alerts to receive a notification
                        whenever you physically arrive at a saved farm location
                        with active weather alerts.
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}

            {permission !== "granted" && !enabled && (
              <>
                <Divider />
                <Pressable
                  style={({ pressed }) => [
                    s(colors).enableNotifBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => requestAndEnable()}
                  testID="button-enable-notifications"
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={colors.primaryForeground}
                  />
                  <Text style={s(colors).enableNotifBtnText}>
                    Enable Notifications
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>

      {/* Locations */}
      <SectionHeader title="Locations" />
      <View style={s(colors).sectionCard}>
        {locations?.map((loc, i) => (
          <React.Fragment key={loc.id}>
            {i > 0 && <Divider />}
            <SettingRow
              icon={loc.isDefault ? "location" : "location-outline"}
              label={loc.name}
              value={loc.isDefault ? "Default" : undefined}
              testID={`location-row-${loc.id}`}
            />
          </React.Fragment>
        ))}
        {(locations?.length ?? 0) > 0 && <Divider />}
        <Pressable
          style={({ pressed }) => [
            s(colors).addLocBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setAddingLocation(!addingLocation)}
          testID="button-add-location"
        >
          <Ionicons
            name={addingLocation ? "close-outline" : "add"}
            size={20}
            color={colors.primary}
          />
          <Text style={s(colors).addLocText}>
            {addingLocation ? "Cancel" : "Add location"}
          </Text>
        </Pressable>

        {addingLocation && (
          <View style={s(colors).addLocForm}>
            <TextInput
              style={s(colors).locInput}
              placeholder="Location name (e.g. Home Farm)"
              placeholderTextColor={colors.mutedForeground}
              value={locName}
              onChangeText={setLocName}
              testID="input-location-name"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[s(colors).locInput, { flex: 1 }]}
                placeholder="Latitude"
                placeholderTextColor={colors.mutedForeground}
                value={locLat}
                onChangeText={setLocLat}
                keyboardType="decimal-pad"
                testID="input-latitude"
              />
              <TextInput
                style={[s(colors).locInput, { flex: 1 }]}
                placeholder="Longitude"
                placeholderTextColor={colors.mutedForeground}
                value={locLng}
                onChangeText={setLocLng}
                keyboardType="decimal-pad"
                testID="input-longitude"
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                s(colors).saveLocBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleAddLocation}
              disabled={createLocation.isPending}
              testID="button-save-location"
            >
              {createLocation.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryForeground}
                />
              ) : (
                <Text style={s(colors).saveLocBtnText}>Save Location</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Subscription */}
      <SectionHeader title="Subscription" />
      <View style={s(colors).sectionCard}>
        <SettingRow
          icon="card-outline"
          label="Current plan"
          value={tierInfo.label}
          testID="row-current-plan"
        />
        {sub?.currentPeriodEnd && (
          <>
            <Divider />
            <SettingRow
              icon="calendar-outline"
              label="Renews"
              value={new Date(sub.currentPeriodEnd).toLocaleDateString()}
            />
          </>
        )}
      </View>

      {/* Account */}
      <SectionHeader title="Account" />
      <View style={s(colors).sectionCard}>
        <SettingRow
          icon="log-out-outline"
          label="Sign out"
          onPress={handleSignOut}
          destructive
          testID="button-sign-out"
        />
      </View>

      <Text style={s(colors).version}>Bloomy v1.0.0</Text>
    </ScrollView>
  );
}

const s = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 26,
      fontFamily: "Outfit_700Bold",
      color: colors.primaryForeground,
    },
    profileName: {
      fontSize: 20,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    profileEmail: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    tierBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      borderWidth: 1,
      alignSelf: "flex-start",
    },
    tierDot: { width: 6, height: 6, borderRadius: 3 },
    tierText: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
    sectionCard: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.muted,
    },
    statusText: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      lineHeight: 17,
    },
    notifInfoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.muted,
    },
    notifInfoText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    enableNotifBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      margin: 12,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
      justifyContent: "center",
    },
    enableNotifBtnText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primaryForeground,
    },
    openSettingsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    openSettingsBtnText: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.primary,
    },
    addLocBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    addLocText: {
      fontSize: 15,
      fontFamily: "Outfit_500Medium",
      color: colors.primary,
    },
    addLocForm: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 10,
    },
    locInput: {
      height: 46,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Outfit_400Regular",
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    saveLocBtn: {
      height: 46,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveLocBtnText: {
      fontSize: 15,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primaryForeground,
    },
    version: {
      textAlign: "center",
      fontSize: 12,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      marginTop: 32,
    },
  });
