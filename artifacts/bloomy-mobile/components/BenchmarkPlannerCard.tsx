import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CreateFieldNoteBodyCategory,
  getGetFieldNotesQueryKey,
  type FarmProfile,
  type InputCost,
  useCreateFieldNote,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import {
  BENCHMARK_DEMO_DISCLAIMER,
  calculateBenchmarkScenario,
  deriveInputCostSummary,
  formatMoney,
  formatNumber,
  getBenchmarkForCrop,
  getInitialBenchmarkScenario,
  type BenchmarkComparison,
  type BenchmarkRange,
  type BenchmarkScenarioValues,
  type BenchmarkTone,
} from "@/lib/benchmarkPlanner";
import { generateBenchmarkPlannerHtml } from "@/lib/benchmarkPlannerReport";

interface Props {
  farmProfileId: number;
  profile: FarmProfile;
  inputCosts: InputCost[];
  locationName?: string | null;
}

type DecisionKey = "review" | "renegotiate" | "delay" | "revise";

const DECISIONS: Array<{ key: DecisionKey; label: string }> = [
  { key: "review", label: "Review input quote" },
  { key: "renegotiate", label: "Renegotiate quote" },
  { key: "delay", label: "Delay purchase" },
  { key: "revise", label: "Revise plan" },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function editable(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function parseScenarioValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function cleanNumericInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function toneColor(tone: BenchmarkTone, colors: ReturnType<typeof useColors>) {
  switch (tone) {
    case "good":
      return { text: colors.primary, bg: `${colors.primary}18`, border: `${colors.primary}33` };
    case "watch":
      return { text: colors.secondary, bg: `${colors.secondary}1F`, border: `${colors.secondary}40` };
    case "risk":
      return { text: colors.destructive, bg: `${colors.destructive}14`, border: `${colors.destructive}30` };
    case "missing":
      return { text: colors.mutedForeground, bg: colors.muted, border: colors.border };
    case "neutral":
    default:
      return { text: colors.foreground, bg: colors.muted, border: colors.border };
  }
}

function formatRange(range: BenchmarkRange): string {
  return `${formatMoney(range.low)}-${formatMoney(range.high)}/acre`;
}

function StatusBadge({ comparison }: { comparison: BenchmarkComparison }) {
  const colors = useColors();
  const tone = toneColor(comparison.tone, colors);
  return (
    <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[s.badgeText, { color: tone.text }]}>{comparison.label}</Text>
    </View>
  );
}

function ScenarioInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  suffix: string;
}) {
  const colors = useColors();
  return (
    <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          value={value}
          onChangeText={(next) => onChange(cleanNumericInput(next))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          style={[s.input, { color: colors.foreground }]}
        />
        <Text style={[s.inputSuffix, { color: colors.mutedForeground }]}>{suffix}</Text>
      </View>
    </View>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: BenchmarkTone;
}) {
  const colors = useColors();
  const toneTokens = tone ? toneColor(tone, colors) : null;
  return (
    <View style={[s.metric, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[s.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.metricValue, { color: toneTokens?.text ?? colors.foreground }]}>{value}</Text>
      <Text style={[s.metricSub, { color: colors.mutedForeground }]}>{sub}</Text>
    </View>
  );
}

function ComparisonRow({
  label,
  value,
  range,
  comparison,
}: {
  label: string;
  value: number;
  range: BenchmarkRange;
  comparison: BenchmarkComparison;
}) {
  const colors = useColors();
  return (
    <View style={[s.compareRow, { borderColor: colors.border }]}>
      <View style={s.compareMain}>
        <Text style={[s.compareLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[s.comparePeer, { color: colors.mutedForeground }]}>
          Peer range {formatRange(range)} · median {formatMoney(range.median)}
        </Text>
      </View>
      <View style={s.compareRight}>
        <Text style={[s.compareValue, { color: colors.foreground }]}>{formatMoney(value)}/acre</Text>
        <StatusBadge comparison={comparison} />
      </View>
    </View>
  );
}

export default function BenchmarkPlannerCard({
  farmProfileId,
  profile,
  inputCosts,
  locationName,
}: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const styles = s;
  const benchmark = useMemo(() => getBenchmarkForCrop(profile.cropType), [profile.cropType]);
  const trackedCosts = useMemo(
    () => deriveInputCostSummary(inputCosts, profile.acreage),
    [inputCosts, profile.acreage]
  );

  const [seed, setSeed] = useState("");
  const [fertilizer, setFertilizer] = useState("");
  const [chemicals, setChemicals] = useState("");
  const [yieldPerAcre, setYieldPerAcre] = useState("");
  const [cropPrice, setCropPrice] = useState("");
  const [decision, setDecision] = useState<DecisionKey>("review");
  const [sharing, setSharing] = useState(false);

  const initialScenario = useMemo(
    () => benchmark ? getInitialBenchmarkScenario(profile, inputCosts, benchmark) : null,
    [benchmark, inputCosts, profile]
  );

  useEffect(() => {
    if (!initialScenario) return;
    setSeed(editable(initialScenario.seed));
    setFertilizer(editable(initialScenario.fertilizer));
    setChemicals(editable(initialScenario.chemicals));
    setYieldPerAcre(editable(initialScenario.yieldPerAcre));
    setCropPrice(editable(initialScenario.cropPrice));
  }, [initialScenario, profile.id]);

  const createNote = useCreateFieldNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetFieldNotesQueryKey(farmProfileId),
        });
      },
    },
  });

  const activeBenchmark = benchmark;
  const activeInitialScenario = initialScenario;

  if (!activeBenchmark || !activeInitialScenario) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="bar-chart" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Benchmark Planner</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Missouri / Midwest peer comparison
            </Text>
          </View>
        </View>
        <View style={[styles.emptyState, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Corn and soybeans supported first
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Benchmark Planner currently supports corn and soybeans for the Missouri/Midwest demo.
          </Text>
        </View>
      </View>
    );
  }

  const safeBenchmark: NonNullable<typeof activeBenchmark> = activeBenchmark;
  const safeInitialScenario: NonNullable<typeof activeInitialScenario> = activeInitialScenario;

  const scenarioValues: BenchmarkScenarioValues = {
    seed: parseScenarioValue(seed, safeInitialScenario.seed),
    fertilizer: parseScenarioValue(fertilizer, safeInitialScenario.fertilizer),
    chemicals: parseScenarioValue(chemicals, safeInitialScenario.chemicals),
    other: safeInitialScenario.other,
    yieldPerAcre: parseScenarioValue(yieldPerAcre, safeInitialScenario.yieldPerAcre),
    cropPrice: parseScenarioValue(cropPrice, safeInitialScenario.cropPrice),
    acreage: safeInitialScenario.acreage,
  };
  const result = calculateBenchmarkScenario(scenarioValues, safeBenchmark);
  const decisionLabel = DECISIONS.find((item) => item.key === decision)?.label ?? "Review input quote";
  const currentCostPerAcre =
    trackedCosts.itemizedCount > 0 ? trackedCosts.total : profile.costPerAcre ?? null;
  const usesSampleDefaults = trackedCosts.itemizedCount === 0;
  const hasMissingPlanningData = profile.cropPrice == null || profile.yieldGoal == null;

  function buildDecisionBody() {
    const acresLine = scenarioValues.acreage != null
      ? `${formatNumber(scenarioValues.acreage)} acres`
      : "Acreage not set";
    return [
      `Benchmark Planner decision: ${decisionLabel}`,
      "",
      `Farm: ${profile.name}`,
      `Crop: ${safeBenchmark.cropLabel}`,
      `Region: ${safeBenchmark.regionLabel}`,
      `Acres: ${acresLine}`,
      "",
      BENCHMARK_DEMO_DISCLAIMER,
      "",
      "Scenario before signing:",
      `- Seed: ${formatMoney(scenarioValues.seed)}/acre (${result.comparisons.seed.label})`,
      `- Fertilizer: ${formatMoney(scenarioValues.fertilizer)}/acre (${result.comparisons.fertilizer.label})`,
      `- Chemicals: ${formatMoney(scenarioValues.chemicals)}/acre (${result.comparisons.chemicals.label})`,
      `- Total input cost: ${formatMoney(result.totalInputCost)}/acre (${result.comparisons.totalInputCost.label})`,
      `- Expected yield: ${formatNumber(scenarioValues.yieldPerAcre)} ${safeBenchmark.yieldUnit}`,
      `- Crop price: ${formatMoney(scenarioValues.cropPrice, 2)} ${safeBenchmark.priceUnit}`,
      `- Projected margin: ${formatMoney(result.marginPerAcre)}/acre (${result.comparisons.margin.label})`,
      `- Peer median margin: ${formatMoney(safeBenchmark.metrics.margin.median)}/acre`,
      `- Margin gap: ${formatMoney(result.marginGapPerAcre)}/acre`,
      result.totalFarmMargin != null
        ? `- Projected total farm margin: ${formatMoney(result.totalFarmMargin)}`
        : null,
    ].filter(Boolean).join("\n");
  }

  async function handleSaveDecision() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createNote.mutateAsync({
        id: farmProfileId,
        data: {
          date: todayISO(),
          category: CreateFieldNoteBodyCategory.general,
          severity: result.summary.tone === "risk" ? "medium" : null,
          title: `Benchmark decision: ${decisionLabel}`,
          body: buildDecisionBody(),
          photoData: null,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Decision saved", "The benchmark decision was added to this farm's notes.");
    } catch (error: any) {
      Alert.alert("Could not save decision", error?.message ?? "Please try again.");
    }
  }

  async function handleShareSummary() {
    if (Platform.OS === "web") {
      Alert.alert("Not supported", "PDF export is not available on web.");
      return;
    }

    try {
      setSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = generateBenchmarkPlannerHtml({
        farmName: profile.name,
        locationName,
        benchmark: safeBenchmark,
        result,
        decisionLabel,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${profile.name} - Benchmark Planner`,
        UTI: "com.adobe.pdf",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_err) {
      // sharing cancelled or unsupported
    } finally {
      setSharing(false);
    }
  }

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID="benchmark-planner-card"
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="bar-chart" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Benchmark Planner</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Compare costs and margin before signing input agreements
          </Text>
        </View>
      </View>

      <View style={[styles.disclaimer, { backgroundColor: `${colors.secondary}18`, borderColor: `${colors.secondary}40` }]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.secondary} />
        <Text style={[styles.disclaimerText, { color: colors.foreground }]}>
          {BENCHMARK_DEMO_DISCLAIMER}
        </Text>
      </View>

      <View style={styles.contextRow}>
        <View style={[styles.contextChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.contextLabel, { color: colors.mutedForeground }]}>Crop</Text>
          <Text style={[styles.contextValue, { color: colors.foreground }]}>{safeBenchmark.cropLabel}</Text>
        </View>
        <View style={[styles.contextChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.contextLabel, { color: colors.mutedForeground }]}>Acres</Text>
          <Text style={[styles.contextValue, { color: colors.foreground }]}>
            {scenarioValues.acreage != null ? formatNumber(scenarioValues.acreage) : "Not set"}
          </Text>
        </View>
        <View style={[styles.contextChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.contextLabel, { color: colors.mutedForeground }]}>Region</Text>
          <Text style={[styles.contextValue, { color: colors.foreground }]}>Missouri / Midwest</Text>
        </View>
      </View>

      {(usesSampleDefaults || hasMissingPlanningData) && (
        <View style={[styles.notice, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            {usesSampleDefaults
              ? "No itemized costs are logged yet. The scenario starts with peer sample defaults and can be edited before comparing."
              : "Some planning values are missing, so the scenario uses editable benchmark defaults."}
          </Text>
        </View>
      )}

      <View style={styles.metricsGrid}>
        <MetricTile
          label="Tracked cost"
          value={currentCostPerAcre != null ? `${formatMoney(currentCostPerAcre)}/acre` : "Not logged"}
          sub={trackedCosts.itemizedCount > 0 ? `${trackedCosts.itemizedCount} costs logged` : "Profile estimate or sample"}
        />
        <MetricTile
          label="Scenario cost"
          value={`${formatMoney(result.totalInputCost)}/acre`}
          sub={result.comparisons.totalInputCost.label}
          tone={result.comparisons.totalInputCost.tone}
        />
        <MetricTile
          label="Projected margin"
          value={`${formatMoney(result.marginPerAcre)}/acre`}
          sub={`Peer median ${formatMoney(safeBenchmark.metrics.margin.median)}`}
          tone={result.comparisons.margin.tone}
        />
        <MetricTile
          label="Total impact"
          value={result.totalFarmMargin != null ? formatMoney(result.totalFarmMargin) : "Per-acre only"}
          sub={result.totalFarmMargin != null ? "Projected farm margin" : "Add acres for total"}
        />
      </View>

      <View style={[styles.summaryBox, { backgroundColor: toneColor(result.summary.tone, colors).bg, borderColor: toneColor(result.summary.tone, colors).border }]}>
        <View style={styles.summaryTop}>
          <Ionicons
            name={result.summary.tone === "risk" ? "warning-outline" : "checkmark-circle-outline"}
            size={18}
            color={toneColor(result.summary.tone, colors).text}
          />
          <Text style={[styles.summaryTitle, { color: toneColor(result.summary.tone, colors).text }]}>
            {result.summary.label}
          </Text>
        </View>
        <Text style={[styles.summaryText, { color: colors.foreground }]}>
          Your scenario margin is {formatMoney(Math.abs(result.marginGapPerAcre))}/acre{" "}
          {result.marginGapPerAcre >= 0 ? "above" : "below"} the regional peer median.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: colors.foreground }]}>Quote review scenario</Text>
        <View style={styles.inputGrid}>
          <ScenarioInput label="Seed" value={seed} onChange={setSeed} suffix="$/acre" />
          <ScenarioInput label="Fertilizer" value={fertilizer} onChange={setFertilizer} suffix="$/acre" />
          <ScenarioInput label="Chemicals" value={chemicals} onChange={setChemicals} suffix="$/acre" />
          <ScenarioInput label="Expected yield" value={yieldPerAcre} onChange={setYieldPerAcre} suffix={safeBenchmark.yieldUnit} />
          <ScenarioInput label="Crop price" value={cropPrice} onChange={setCropPrice} suffix={safeBenchmark.priceUnit} />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: colors.foreground }]}>Peer comparison</Text>
        <View style={[styles.compareWrap, { borderColor: colors.border }]}>
          <ComparisonRow
            label="Seed"
            value={scenarioValues.seed}
            range={safeBenchmark.metrics.seed}
            comparison={result.comparisons.seed}
          />
          <ComparisonRow
            label="Fertilizer"
            value={scenarioValues.fertilizer}
            range={safeBenchmark.metrics.fertilizer}
            comparison={result.comparisons.fertilizer}
          />
          <ComparisonRow
            label="Chemicals"
            value={scenarioValues.chemicals}
            range={safeBenchmark.metrics.chemicals}
            comparison={result.comparisons.chemicals}
          />
          <ComparisonRow
            label="Total inputs"
            value={result.totalInputCost}
            range={safeBenchmark.metrics.totalInputCost}
            comparison={result.comparisons.totalInputCost}
          />
          <ComparisonRow
            label="Projected margin"
            value={result.marginPerAcre}
            range={safeBenchmark.metrics.margin}
            comparison={result.comparisons.margin}
          />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: colors.foreground }]}>Decision</Text>
        <View style={styles.decisionGrid}>
          {DECISIONS.map((item) => {
            const selected = item.key === decision;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setDecision(item.key);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.decisionChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.decisionText,
                    { color: selected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.78 },
            createNote.isPending && { opacity: 0.6 },
          ]}
          onPress={handleSaveDecision}
          disabled={createNote.isPending}
        >
          {createNote.isPending ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : (
            <Ionicons name="bookmark-outline" size={17} color="#fff" />
          )}
          <Text style={styles.primaryBtnText}>
            {createNote.isPending ? "Saving..." : "Save decision note"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.border, backgroundColor: colors.background },
            pressed && { opacity: 0.78 },
            sharing && { opacity: 0.6 },
          ]}
          onPress={handleShareSummary}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size={16} color={colors.primary} />
          ) : (
            <Ionicons name="share-outline" size={17} color={colors.primary} />
          )}
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            {sharing ? "Exporting..." : "Share summary"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    marginTop: 1,
    lineHeight: 16,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    lineHeight: 15,
  },
  contextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextChip: {
    minWidth: "30%",
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  contextLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  contextValue: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
    marginTop: 4,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    width: "48.7%",
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    marginTop: 8,
  },
  metricSub: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    lineHeight: 14,
    marginTop: 4,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 7,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
  },
  summaryText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    lineHeight: 17,
  },
  block: {
    gap: 10,
  },
  blockTitle: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
  },
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inputWrap: {
    width: "48.7%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  input: {
    flex: 1,
    minWidth: 42,
    padding: 0,
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
  },
  inputSuffix: {
    fontSize: 10,
    fontFamily: "Outfit_500Medium",
  },
  compareWrap: {
    borderTopWidth: 1,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  compareMain: {
    flex: 1,
    minWidth: 0,
  },
  compareLabel: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
  },
  comparePeer: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    lineHeight: 15,
    marginTop: 3,
  },
  compareRight: {
    alignItems: "flex-end",
    gap: 5,
    maxWidth: "45%",
  },
  compareValue: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
  },
  decisionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  decisionChip: {
    minWidth: "48%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  decisionText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
  },
  actions: {
    gap: 8,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    lineHeight: 17,
    textAlign: "center",
  },
});
