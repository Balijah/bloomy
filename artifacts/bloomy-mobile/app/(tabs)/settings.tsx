import { useGetMe, useGetCurrentSubscription, useGetLocations, useCreateLocation } from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

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
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [rowStyles(colors).row, pressed && onPress && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
    >
      <View style={[rowStyles(colors).icon, destructive && { backgroundColor: colors.destructive + "22" }]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <Text style={[rowStyles(colors).label, destructive && { color: colors.destructive }]}>{label}</Text>
      {value && <Text style={rowStyles(colors).value}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
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
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { signOut } = useAuth();

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
      Alert.alert("Invalid input", "Please enter a name, latitude, and longitude.");
      return;
    }
    createLocation.mutate(
      { data: { name: locName.trim(), lat, lng, isDefault: !locations?.length } },
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 + 16 : insets.bottom + 80 }}
    >
      {/* Profile header */}
      <View style={[s(colors).profileHeader, { paddingTop: topPad + 16 }]}>
        <View style={s(colors).avatar}>
          <Text style={s(colors).avatarText}>
            {user?.firstName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "G"}
          </Text>
        </View>
        <View>
          <Text style={s(colors).profileName}>
            {user?.firstName ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : "Grower"}
          </Text>
          <Text style={s(colors).profileEmail}>{user?.email}</Text>
          <View style={[s(colors).tierBadge, { borderColor: tierInfo.color + "55" }]}>
            <View style={[s(colors).tierDot, { backgroundColor: tierInfo.color }]} />
            <Text style={[s(colors).tierText, { color: tierInfo.color }]}>{tierInfo.label}</Text>
          </View>
        </View>
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
          style={({ pressed }) => [s(colors).addLocBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setAddingLocation(!addingLocation)}
          testID="button-add-location"
        >
          <Ionicons name={addingLocation ? "close-outline" : "add"} size={20} color={colors.primary} />
          <Text style={s(colors).addLocText}>{addingLocation ? "Cancel" : "Add location"}</Text>
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
              style={({ pressed }) => [s(colors).saveLocBtn, pressed && { opacity: 0.8 }]}
              onPress={handleAddLocation}
              disabled={createLocation.isPending}
              testID="button-save-location"
            >
              {createLocation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
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
