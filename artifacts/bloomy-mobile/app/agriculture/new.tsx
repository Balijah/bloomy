import {
  useCreateLocation,
  useCreateFarmProfile,
  useCreateInputCost,
  useGetLocations,
  getGetDashboardSummaryQueryKey,
  getGetLocationsQueryKey,
  getGetFarmProfilesQueryKey,
  getGetInputCostsQueryKey,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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
import LocationPicker from "@/components/LocationPicker";

// ─── Constants ────────────────────────────────────────────────────────────────

const CROPS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "corn", label: "Corn", emoji: "🌽" },
  { key: "soybeans", label: "Soybeans", emoji: "🫘" },
  { key: "winter_wheat", label: "Winter Wheat", emoji: "🌾" },
  { key: "cotton", label: "Cotton", emoji: "🌸" },
  { key: "almonds", label: "Almonds", emoji: "🌰" },
  { key: "grapes", label: "Grapes", emoji: "🍇" },
  { key: "apples", label: "Apples", emoji: "🍎" },
  { key: "potatoes", label: "Potatoes", emoji: "🥔" },
  { key: "rice", label: "Rice", emoji: "🌾" },
  { key: "other", label: "Other", emoji: "🌱" },
];

const SOIL_TYPES = ["Clay", "Sandy", "Silt", "Loam", "Peat", "Chalk", "Other"];

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontSize: 12,
        fontFamily: "Outfit_600SemiBold",
        color: colors.mutedForeground,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 6,
      }}
    >
      {text}
    </Text>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  ...rest
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "numeric";
  [key: string]: any;
}) {
  const colors = useColors();
  return (
    <TextInput
      style={{
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 15,
        fontFamily: "Outfit_400Regular",
        color: colors.foreground,
        backgroundColor: colors.background,
      }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      keyboardType={keyboardType}
      {...rest}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type LocationMode = "new" | "existing";

export default function NewFarmScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();
  const initializedLocationModeRef = useRef(false);

  const { data: savedLocations } = useGetLocations();
  const createLocation = useCreateLocation();
  const createFarmProfile = useCreateFarmProfile();
  const createInputCost = useCreateInputCost();

  // ── Step state ──
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1: location ──
  const [locationMode, setLocationMode] = useState<LocationMode>("new");
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  // ── Step 2: farm details ──
  const [farmName, setFarmName] = useState("");
  const [cropType, setCropType] = useState<string | null>(null);
  const [acreage, setAcreage] = useState("");
  const [soilType, setSoilType] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [yieldGoal, setYieldGoal] = useState("");
  const [cropPrice, setCropPrice] = useState("");
  const [seedCost, setSeedCost] = useState("");
  const [fertilizerCost, setFertilizerCost] = useState("");
  const [chemicalCost, setChemicalCost] = useState("");

  const isSaving =
    createLocation.isPending ||
    createFarmProfile.isPending ||
    createInputCost.isPending;

  useEffect(() => {
    if (initializedLocationModeRef.current || !savedLocations?.length) return;
    const preferredLocation = savedLocations.find((loc) => loc.isDefault) ?? savedLocations[0];
    initializedLocationModeRef.current = true;
    setLocationMode("existing");
    setSelectedLocationId(preferredLocation.id);
  }, [savedLocations]);

  // ─── Step 1 validation ───────────────────────────────────────────────────
  function step1Valid() {
    if (locationMode === "new") {
      return (
        locationName.trim().length > 0 &&
        pickedCoords !== null
      );
    }
    return selectedLocationId !== null;
  }

  // ─── Step 2 validation ───────────────────────────────────────────────────
  function step2Valid() {
    return farmName.trim().length > 0 && cropType !== null;
  }

  // ─── Submit ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!step2Valid()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let locationId: number;

      if (locationMode === "new") {
        if (!pickedCoords) return;
        const loc = await createLocation.mutateAsync({
          data: {
            name: locationName.trim(),
            lat: pickedCoords.lat,
            lng: pickedCoords.lng,
          },
        });
        locationId = loc.id;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
        ]);
      } else {
        if (!selectedLocationId) return;
        locationId = selectedLocationId;
      }

      const parsedAcreage = parseOptionalNumber(acreage);
      const parsedYieldGoal = parseOptionalNumber(yieldGoal);
      const parsedCropPrice = parseOptionalNumber(cropPrice);
      const parsedSeedCost = parseOptionalNumber(seedCost);
      const parsedFertilizerCost = parseOptionalNumber(fertilizerCost);
      const parsedChemicalCost = parseOptionalNumber(chemicalCost);
      const totalPlannedCost =
        (parsedSeedCost ?? 0) +
        (parsedFertilizerCost ?? 0) +
        (parsedChemicalCost ?? 0);

      const profile = await createFarmProfile.mutateAsync({
        data: {
          locationId,
          name: farmName.trim(),
          cropType: cropType as any,
          acreage: parsedAcreage,
          soilType: soilType.trim() || null,
          plantingDate: plantingDate.trim() || null,
          yieldGoal: parsedYieldGoal,
          cropPrice: parsedCropPrice,
          costPerAcre: totalPlannedCost > 0 ? totalPlannedCost : null,
        },
      });

      const plannedCosts = [
        { category: "seed", item: "Seed quote", value: parsedSeedCost },
        {
          category: "fertilizer",
          item: "Fertilizer quote",
          value: parsedFertilizerCost,
        },
        { category: "herbicide", item: "Chemical quote", value: parsedChemicalCost },
      ].filter((item) => item.value != null && item.value > 0);

      if (plannedCosts.length > 0) {
        await Promise.all(
          plannedCosts.map((item) =>
            createInputCost.mutateAsync({
              id: profile.id,
              data: {
                category: item.category as any,
                item: item.item,
                costPerAcre: item.value,
                totalCost: null,
                acresApplied: parsedAcreage,
                notes: "Added during farm setup for Benchmark Planner.",
              },
            })
          )
        );
        await queryClient.invalidateQueries({
          queryKey: getGetInputCostsQueryKey(profile.id),
        });
      }

      await queryClient.invalidateQueries({
        queryKey: getGetFarmProfilesQueryKey(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (e?.status === 403 && locationMode === "new" && savedLocations?.length) {
        const preferredLocation = savedLocations.find((loc) => loc.isDefault) ?? savedLocations[0];
        setLocationMode("existing");
        setSelectedLocationId(preferredLocation.id);
        setStep(1);
        Alert.alert(
          "Use saved location",
          "Your Free plan includes one saved location. I selected it for this farm profile."
        );
        return;
      }

      Alert.alert(
        "Could not save",
        e?.message ?? "Something went wrong. Please try again."
      );
    }
  }

  // ─── Render step 1 content ───────────────────────────────────────────────
  function renderStep1() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode toggle */}
        <View style={[s.segmented, { backgroundColor: colors.muted }]}>
          {(["new", "existing"] as LocationMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                s.segBtn,
                locationMode === mode && {
                  backgroundColor: colors.card,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: 2,
                },
              ]}
              onPress={() => setLocationMode(mode)}
            >
              <Text
                style={[
                  s.segText,
                  {
                    color:
                      locationMode === mode
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      locationMode === mode
                        ? "Outfit_600SemiBold"
                        : "Outfit_400Regular",
                  },
                ]}
              >
                {mode === "new" ? "Drop a Pin" : "Saved Location"}
              </Text>
            </Pressable>
          ))}
        </View>

        {locationMode === "new" ? (
          <>
            {/* Map picker */}
            <View style={{ gap: 6 }}>
              <FieldLabel text="Pin location on map" />
              <LocationPicker onCoordsChange={setPickedCoords} />
              {!pickedCoords && (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Outfit_400Regular",
                    color: colors.mutedForeground,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Pan the map to position the pin over your farm
                </Text>
              )}
            </View>

            {/* Location name */}
            <View style={{ gap: 6 }}>
              <FieldLabel text="Location name" />
              <StyledInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="e.g. North Field, Home Farm"
              />
            </View>
          </>
        ) : (
          /* Saved location picker */
          <View style={{ gap: 8 }}>
            <FieldLabel text="Choose a saved location" />
            {!savedLocations || savedLocations.length === 0 ? (
              <View
                style={[
                  s.emptyLocations,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={32}
                  color={colors.mutedForeground}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_400Regular",
                    color: colors.mutedForeground,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  No saved locations yet.{"\n"}Switch to "Drop a Pin" to add one.
                </Text>
              </View>
            ) : (
              savedLocations.map((loc) => {
                const selected = selectedLocationId === loc.id;
                return (
                  <Pressable
                    key={loc.id}
                    style={[
                      s.locRow,
                      {
                        backgroundColor: selected
                          ? colors.primary + "18"
                          : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedLocationId(loc.id);
                    }}
                  >
                    <View
                      style={[
                        s.locDot,
                        {
                          backgroundColor: selected
                            ? colors.primary
                            : colors.muted,
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      {selected && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontFamily: "Outfit_600SemiBold",
                          color: colors.foreground,
                        }}
                      >
                        {loc.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Outfit_400Regular",
                          color: colors.mutedForeground,
                          marginTop: 2,
                        }}
                      >
                        {loc.lat.toFixed(4)}°, {loc.lng.toFixed(4)}°
                      </Text>
                    </View>
                    {loc.isDefault && (
                      <View
                        style={[
                          s.defaultBadge,
                          { backgroundColor: colors.primary + "22" },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Outfit_600SemiBold",
                            color: colors.primary,
                          }}
                        >
                          Default
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Render step 2 content ───────────────────────────────────────────────
  function renderStep2() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Farm name */}
        <View style={{ gap: 6 }}>
          <FieldLabel text="Farm name *" />
          <StyledInput
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Home Farm, North 40"
          />
        </View>

        {/* Crop type */}
        <View style={{ gap: 8 }}>
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
                      borderColor: selected ? colors.primary : colors.border,
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

        {/* Acreage */}
        <View style={{ gap: 6 }}>
          <FieldLabel text="Acreage (optional)" />
          <StyledInput
            value={acreage}
            onChangeText={setAcreage}
            placeholder="e.g. 240"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Planting date */}
        <View style={{ gap: 6 }}>
          <FieldLabel text="Planting date (optional)" />
          <StyledInput
            value={plantingDate}
            onChangeText={setPlantingDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={{ gap: 8 }}>
          <FieldLabel text="Benchmark Planner setup (optional)" />
          <Text style={[s.helperText, { color: colors.mutedForeground }]}>
            Add planning values now so the farm opens with useful margin and
            peer benchmark comparisons.
          </Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>
                Expected yield
              </Text>
              <StyledInput
                value={yieldGoal}
                onChangeText={setYieldGoal}
                placeholder="e.g. 185"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.col}>
              <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>
                Crop price
              </Text>
              <StyledInput
                value={cropPrice}
                onChangeText={setCropPrice}
                placeholder="e.g. 4.55"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>
                Seed $/acre
              </Text>
              <StyledInput
                value={seedCost}
                onChangeText={setSeedCost}
                placeholder="e.g. 118"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.col}>
              <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>
                Fertilizer $/acre
              </Text>
              <StyledInput
                value={fertilizerCost}
                onChangeText={setFertilizerCost}
                placeholder="e.g. 172"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[s.miniLabel, { color: colors.mutedForeground }]}>
              Chemicals $/acre
            </Text>
            <StyledInput
              value={chemicalCost}
              onChangeText={setChemicalCost}
              placeholder="e.g. 68"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Soil type */}
        <View style={{ gap: 8 }}>
          <FieldLabel text="Soil type (optional)" />
          <View style={s.soilRow}>
            {SOIL_TYPES.map((st) => {
              const selected = soilType === st;
              return (
                <Pressable
                  key={st}
                  style={[
                    s.soilChip,
                    {
                      backgroundColor: selected
                        ? colors.primary + "18"
                        : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSoilType(selected ? "" : st);
                  }}
                >
                  <Text
                    style={[
                      s.soilText,
                      {
                        color: selected ? colors.primary : colors.mutedForeground,
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
      </ScrollView>
    );
  }

  // ─── Layout ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step === 1 ? router.back() : setStep(1))} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            {step === 1 ? "Pick Location" : "Farm Details"}
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Step {step} of 2
          </Text>
        </View>
        {/* Step dots */}
        <View style={s.dots}>
          <View style={[s.dot, { backgroundColor: colors.primary }]} />
          <View
            style={[
              s.dot,
              { backgroundColor: step === 2 ? colors.primary : colors.border },
            ]}
          />
        </View>
      </View>

      {/* Body */}
      {step === 1 ? renderStep1() : renderStep2()}

      {/* Footer CTA */}
      <View
        style={[
          s.footer,
          {
            paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 12,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {step === 1 ? (
          <Pressable
            style={({ pressed }) => [
              s.cta,
              { backgroundColor: step1Valid() ? colors.primary : colors.muted },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => {
              if (!step1Valid()) return;
              Haptics.selectionAsync();
              setStep(2);
            }}
            disabled={!step1Valid()}
          >
            <Text
              style={[
                s.ctaText,
                { color: step1Valid() ? "#fff" : colors.mutedForeground },
              ]}
            >
              Next: Farm Details
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={step1Valid() ? "#fff" : colors.mutedForeground}
            />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              s.cta,
              { backgroundColor: step2Valid() ? colors.primary : colors.muted },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSave}
            disabled={!step2Valid() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={step2Valid() ? "#fff" : colors.mutedForeground} />
                <Text
                  style={[
                    s.ctaText,
                    { color: step2Valid() ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  Save Farm Profile
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segText: { fontSize: 14 },

  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  locDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  emptyLocations: {
    alignItems: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
  },

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

  soilRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  soilChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  soilText: { fontSize: 13 },
  helperText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    lineHeight: 19,
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  miniLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
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
