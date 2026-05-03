import {
  useGetFarmProfile,
  useUpdateFarmProfile,
  getGetFarmProfileQueryKey,
  getGetFarmProfilesQueryKey,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import DatePickerField from "@/components/DatePickerField";
import { YIELD_PROFILES_PUBLIC } from "@/lib/yieldForecast";
import { CROP_MARKET_PRICES, CROP_COST_HINTS } from "@/lib/yieldGoal";

// ─── Constants ────────────────────────────────────────────────────────────────

const CROPS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "corn",         label: "Corn",         emoji: "🌽" },
  { key: "soybeans",     label: "Soybeans",     emoji: "🫘" },
  { key: "winter_wheat", label: "Winter Wheat", emoji: "🌾" },
  { key: "cotton",       label: "Cotton",       emoji: "🌸" },
  { key: "almonds",      label: "Almonds",      emoji: "🌰" },
  { key: "grapes",       label: "Grapes",       emoji: "🍇" },
  { key: "apples",       label: "Apples",       emoji: "🍎" },
  { key: "potatoes",     label: "Potatoes",     emoji: "🥔" },
  { key: "rice",         label: "Rice",         emoji: "🌾" },
  { key: "other",        label: "Other",        emoji: "🌱" },
];

const SOIL_TYPES = ["Clay", "Sandy", "Silt", "Loam", "Peat", "Chalk", "Other"];

// ─── Shared sub-components ────────────────────────────────────────────────────

function FieldLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={[fl.label, { color: colors.mutedForeground }]}>{text}</Text>
  );
}
const fl = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
});

function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <TextInput
      style={[
        si.input,
        {
          borderColor: colors.border,
          color: colors.foreground,
          backgroundColor: colors.background,
          height: multiline ? 88 : 48,
          textAlignVertical: multiline ? "top" : "center",
          paddingTop: multiline ? 12 : 0,
        },
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      keyboardType={keyboardType}
      multiline={multiline}
    />
  );
}
const si = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditFarmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = id ? parseInt(id) : 0;
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetFarmProfile(farmId, {
    query: { enabled: !!farmId, queryKey: getGetFarmProfileQueryKey(farmId) },
  });
  const updateFarmProfile = useUpdateFarmProfile();

  // ── Form state ──
  const [name, setName] = useState("");
  const [cropType, setCropType] = useState<string | null>(null);
  const [acreage, setAcreage] = useState("");
  const [yieldGoal, setYieldGoal] = useState("");
  const [cropPrice, setCropPrice] = useState("");
  const [costPerAcre, setCostPerAcre] = useState("");
  const [soilType, setSoilType] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Populate form once the profile loads
  useEffect(() => {
    if (profile && !hydrated) {
      setName(profile.name ?? "");
      setCropType(profile.cropType ?? null);
      setAcreage(profile.acreage != null ? String(profile.acreage) : "");
      setYieldGoal(profile.yieldGoal != null ? String(profile.yieldGoal) : "");
      setCropPrice(profile.cropPrice != null ? String(profile.cropPrice) : "");
      setCostPerAcre(profile.costPerAcre != null ? String(profile.costPerAcre) : "");
      setSoilType(profile.soilType ?? "");
      setPlantingDate(profile.plantingDate ?? "");
      setHarvestDate(profile.harvestDate ?? "");
      setNotes(profile.notes ?? "");
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const isSaving = updateFarmProfile.isPending;
  const isValid = name.trim().length > 0 && cropType !== null;

  // Track whether anything actually changed
  const isDirty =
    hydrated &&
    profile != null &&
    (name !== (profile.name ?? "") ||
      cropType !== (profile.cropType ?? null) ||
      acreage !== (profile.acreage != null ? String(profile.acreage) : "") ||
      yieldGoal !== (profile.yieldGoal != null ? String(profile.yieldGoal) : "") ||
      cropPrice !== (profile.cropPrice != null ? String(profile.cropPrice) : "") ||
      costPerAcre !== (profile.costPerAcre != null ? String(profile.costPerAcre) : "") ||
      soilType !== (profile.soilType ?? "") ||
      plantingDate !== (profile.plantingDate ?? "") ||
      harvestDate !== (profile.harvestDate ?? "") ||
      notes !== (profile.notes ?? ""));

  async function handleSave() {
    if (!isValid || !isDirty) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateFarmProfile.mutateAsync({
        id: farmId,
        data: {
          name: name.trim(),
          cropType: cropType as any,
          acreage: acreage ? parseFloat(acreage) : null,
          yieldGoal: yieldGoal ? parseFloat(yieldGoal) : null,
          cropPrice: cropPrice ? parseFloat(cropPrice) : null,
          costPerAcre: costPerAcre ? parseFloat(costPerAcre) : null,
          soilType: soilType.trim() || null,
          plantingDate: plantingDate.trim() || null,
          harvestDate: harvestDate.trim() || null,
          notes: notes.trim() || null,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetFarmProfileQueryKey(farmId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetFarmProfilesQueryKey(),
        }),
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert(
        "Could not save",
        e?.message ?? "Something went wrong. Please try again."
      );
    }
  }

  function handleBackPress() {
    if (isDirty) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }

  // ── Loading state ──
  if (isLoading || !hydrated) {
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

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
          padding: 32,
        }}
      >
        <Ionicons name="warning-outline" size={48} color={colors.mutedForeground} />
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Outfit_600SemiBold",
            color: colors.foreground,
            marginTop: 16,
          }}
        >
          Profile not found
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Outfit_500Medium",
              color: colors.primary,
            }}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ──
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          s.header,
          {
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={handleBackPress} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            Edit Farm
          </Text>
          <Text
            style={[s.subtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {profile.name}
          </Text>
        </View>
        {/* Save button in header for quick access */}
        <Pressable
          style={({ pressed }) => [
            s.saveBtn,
            {
              backgroundColor:
                isValid && isDirty ? colors.primary : colors.muted,
            },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSave}
          disabled={!isValid || !isDirty || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              style={[
                s.saveBtnText,
                {
                  color:
                    isValid && isDirty ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {/* Form */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          paddingBottom:
            Platform.OS === "web" ? 40 : insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Farm name */}
        <View>
          <FieldLabel text="Farm name *" />
          <StyledInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Home Farm, North 40"
          />
        </View>

        {/* Crop type */}
        <View>
          <FieldLabel text="Crop type *" />
          <View style={s.cropGrid}>
            {CROPS.map((c) => {
              const selected = cropType === c.key;
              return (
                <Pressable
                  key={c.key}
                  style={[
                    s.cropBtn,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : colors.card,
                      borderColor: selected
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCropType(c.key);
                  }}
                >
                  <Text style={s.cropEmoji}>{c.emoji}</Text>
                  <Text
                    style={[
                      s.cropLabel,
                      { color: selected ? "#fff" : colors.foreground },
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: colors.border }]} />

        {/* Acreage */}
        <View>
          <FieldLabel text="Acreage (optional)" />
          <StyledInput
            value={acreage}
            onChangeText={setAcreage}
            placeholder="e.g. 240"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Yield goal */}
        <View>
          <FieldLabel
            text={`Yield goal (optional)${cropType ? ` · ${YIELD_PROFILES_PUBLIC[cropType]?.unit ?? "bu/acre"}` : ""}`}
          />
          <StyledInput
            value={yieldGoal}
            onChangeText={setYieldGoal}
            placeholder={
              cropType && YIELD_PROFILES_PUBLIC[cropType]
                ? `e.g. ${YIELD_PROFILES_PUBLIC[cropType].avg}`
                : "e.g. 175"
            }
            keyboardType="decimal-pad"
          />
        </View>

        {/* Crop price */}
        <View>
          <FieldLabel
            text={`Crop price (optional)${
              cropType && YIELD_PROFILES_PUBLIC[cropType]
                ? ` · $/${YIELD_PROFILES_PUBLIC[cropType].unit.split("/")[0]}`
                : " · $/unit"
            }`}
          />
          <StyledInput
            value={cropPrice}
            onChangeText={setCropPrice}
            placeholder={
              cropType && CROP_MARKET_PRICES[cropType]
                ? `e.g. ${CROP_MARKET_PRICES[cropType].price} (${CROP_MARKET_PRICES[cropType].label})`
                : "e.g. 4.50"
            }
            keyboardType="decimal-pad"
          />
        </View>

        {/* Cost per acre */}
        <View>
          <FieldLabel text="Production cost/acre (optional) · $/acre" />
          <StyledInput
            value={costPerAcre}
            onChangeText={setCostPerAcre}
            placeholder={
              cropType && CROP_COST_HINTS[cropType]
                ? `e.g. ${CROP_COST_HINTS[cropType].cost} (${CROP_COST_HINTS[cropType].label})`
                : "e.g. 850"
            }
            keyboardType="decimal-pad"
          />
        </View>

        {/* Soil type chips */}
        <View>
          <FieldLabel text="Soil type (optional)" />
          <View style={s.chipRow}>
            {SOIL_TYPES.map((st) => {
              const selected = soilType === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    s.chip,
                    {
                      backgroundColor: selected
                        ? colors.primary + "18"
                        : colors.card,
                      borderColor: selected
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSoilType(selected ? "" : st);
                  }}
                >
                  <Text
                    style={[
                      s.chipText,
                      {
                        color: selected
                          ? colors.primary
                          : colors.mutedForeground,
                        fontFamily: selected
                          ? "Outfit_600SemiBold"
                          : "Outfit_400Regular",
                      },
                    ]}
                  >
                    {st}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Planting date */}
        <DatePickerField
          label="Planting date (optional)"
          value={plantingDate}
          onChange={setPlantingDate}
          maxDate={new Date()}
        />

        {/* Harvest date */}
        <DatePickerField
          label="Harvest date (optional)"
          value={harvestDate}
          onChange={setHarvestDate}
          minDate={plantingDate ? (() => { const [y,m,d] = plantingDate.split("-").map(Number); return new Date(y,(m??1)-1,(d??1)); })() : undefined}
        />

        {/* Notes */}
        <View>
          <FieldLabel text="Notes (optional)" />
          <StyledInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes about this field…"
            multiline
          />
        </View>

        {/* Unsaved indicator */}
        {isDirty && (
          <View
            style={[
              s.dirtyBanner,
              {
                backgroundColor: colors.primary + "15",
                borderColor: colors.primary + "40",
              },
            ]}
          >
            <Ionicons
              name="ellipse"
              size={8}
              color={colors.primary}
            />
            <Text
              style={[
                s.dirtyText,
                { color: colors.primary },
              ]}
            >
              Unsaved changes
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer save button */}
      <View
        style={[
          s.footer,
          {
            paddingBottom:
              Platform.OS === "web" ? 24 : insets.bottom + 12,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            s.cta,
            {
              backgroundColor:
                isValid && isDirty ? colors.primary : colors.muted,
            },
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleSave}
          disabled={!isValid || !isDirty || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={isValid && isDirty ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[
                  s.ctaText,
                  {
                    color:
                      isValid && isDirty ? "#fff" : colors.mutedForeground,
                  },
                ]}
              >
                {isDirty ? "Save Changes" : "No Changes"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    marginTop: 1,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  divider: { height: 1 },
  cropGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cropBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  cropEmoji: { fontSize: 18 },
  cropLabel: { fontSize: 14, fontFamily: "Outfit_500Medium" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  dirtyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dirtyText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
});
