import { useState, useEffect } from "react";
import type { FarmProfile, InputCost } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Info, TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";
import {
  getBenchmarkForCrop,
  getInitialBenchmarkScenario,
  calculateBenchmarkScenario,
  deriveInputCostSummary,
  formatMoney,
  formatNumber,
  type BenchmarkScenarioValues,
  type BenchmarkTone,
} from "@/lib/benchmarkPlanner";

interface BenchmarkPlannerSectionProps {
  profile: FarmProfile;
  inputCosts: InputCost[];
}

function toneBadgeClass(tone: BenchmarkTone): string {
  switch (tone) {
    case "good": return "bg-green-100 text-green-800 border-green-200";
    case "watch": return "bg-amber-100 text-amber-800 border-amber-200";
    case "risk": return "bg-red-100 text-red-800 border-red-200";
    case "missing": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

function toneCardClass(tone: BenchmarkTone): string {
  switch (tone) {
    case "good": return "border-green-200 bg-green-50 dark:bg-green-950/20";
    case "watch": return "border-amber-200 bg-amber-50 dark:bg-amber-950/20";
    case "risk": return "border-red-200 bg-red-50 dark:bg-red-950/20";
    default: return "border-border bg-muted/30";
  }
}

function ToneIcon({ tone }: { tone: BenchmarkTone }) {
  if (tone === "good") return <TrendingUp className="h-5 w-5 text-green-600" />;
  if (tone === "risk") return <AlertTriangle className="h-5 w-5 text-red-600" />;
  if (tone === "watch") return <TrendingDown className="h-5 w-5 text-amber-600" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

interface ScenarioFieldProps {
  label: string;
  fieldKey: keyof BenchmarkScenarioValues;
  values: BenchmarkScenarioValues;
  onChange: (key: keyof BenchmarkScenarioValues, value: number) => void;
  peerHint?: string;
}

function ScenarioField({ label, fieldKey, values, onChange, peerHint }: ScenarioFieldProps) {
  const raw = values[fieldKey];
  const displayValue = typeof raw === "number" ? String(raw) : "";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input
        type="number"
        min={0}
        step={fieldKey === "cropPrice" ? 0.01 : 1}
        value={displayValue}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= 0) onChange(fieldKey, v);
        }}
        className="font-mono"
      />
      {peerHint && <p className="text-xs text-muted-foreground">{peerHint}</p>}
    </div>
  );
}

export default function BenchmarkPlannerSection({ profile, inputCosts }: BenchmarkPlannerSectionProps) {
  const benchmark = getBenchmarkForCrop(profile.cropType);

  const [scenarioValues, setScenarioValues] = useState<BenchmarkScenarioValues | null>(() =>
    benchmark ? getInitialBenchmarkScenario(profile, inputCosts, benchmark) : null
  );

  useEffect(() => {
    if (benchmark) {
      setScenarioValues(getInitialBenchmarkScenario(profile, inputCosts, benchmark));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputCosts, profile.id]);

  if (!benchmark) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" /> Benchmark Planner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-dashed border-border text-muted-foreground text-sm">
            <Info className="h-4 w-4 shrink-0" />
            <span>Benchmark data is available for corn and soybeans only.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scenarioValues) return null;

  const result = calculateBenchmarkScenario(scenarioValues, benchmark);
  const tracked = deriveInputCostSummary(inputCosts, profile.acreage);

  const handleChange = (key: keyof BenchmarkScenarioValues, value: number) => {
    setScenarioValues((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const m = benchmark.metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" /> Benchmark Planner
          </CardTitle>
          <CardDescription>
            Compare your input costs and projected margin against Iowa peer operations before signing purchase agreements.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Anonymized regional benchmark sample data for demo use. Based on USDA ERS Iowa production cost data. For planning purposes only.</span>
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Crop</p>
            <p className="text-lg font-bold capitalize">{profile.cropType.replace("_", " ")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Acres</p>
            <p className="text-lg font-bold">{profile.acreage != null ? formatNumber(profile.acreage) : "Not set"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Region</p>
            <p className="text-lg font-bold">{benchmark.regionLabel}</p>
            <p className="text-xs text-muted-foreground">{benchmark.seasonLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tracked Cost</p>
            <p className="text-xl font-bold">
              {tracked.itemizedCount > 0 ? `${formatMoney(tracked.total)}/acre` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tracked.itemizedCount > 0 ? `From ${tracked.itemizedCount} logged items` : "No costs logged yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Scenario Cost</p>
            <p className="text-xl font-bold">{formatMoney(result.totalInputCost)}/acre</p>
            <p className={`text-xs mt-1 font-medium ${result.comparisons.totalInputCost.tone === "risk" ? "text-red-600" : result.comparisons.totalInputCost.tone === "watch" ? "text-amber-600" : "text-green-700"}`}>
              {result.comparisons.totalInputCost.label}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Projected Margin</p>
            <p className={`text-xl font-bold ${result.marginPerAcre < 0 ? "text-red-600" : ""}`}>
              {formatMoney(result.marginPerAcre)}/acre
            </p>
            <p className="text-xs text-muted-foreground mt-1">Peer median {formatMoney(m.margin.median)}/acre</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Impact</p>
            <p className="text-xl font-bold">
              {result.totalFarmMargin != null ? formatMoney(result.totalFarmMargin) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {result.totalFarmMargin != null ? "Projected farm margin" : "Add acreage for total"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary callout */}
      <Card className={`border shadow-sm ${toneCardClass(result.summary.tone)}`}>
        <CardContent className="p-4 flex items-center gap-3">
          <ToneIcon tone={result.summary.tone} />
          <div>
            <p className="font-semibold text-sm">{result.summary.label}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Margin gap vs. peer median: {formatMoney(result.marginGapPerAcre, 0)}/acre
              {result.totalFarmMargin != null
                ? ` · Projected farm margin: ${formatMoney(result.totalFarmMargin)}`
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scenario editor */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base">Quote Review Scenario</CardTitle>
          <CardDescription>Edit these values to model different input quotes and see how your margin changes.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ScenarioField
              label="Seed ($/acre)"
              fieldKey="seed"
              values={scenarioValues}
              onChange={handleChange}
              peerHint={`Peer: ${formatMoney(m.seed.low)}–${formatMoney(m.seed.high)} · median ${formatMoney(m.seed.median)}`}
            />
            <ScenarioField
              label="Fertilizer ($/acre)"
              fieldKey="fertilizer"
              values={scenarioValues}
              onChange={handleChange}
              peerHint={`Peer: ${formatMoney(m.fertilizer.low)}–${formatMoney(m.fertilizer.high)} · median ${formatMoney(m.fertilizer.median)}`}
            />
            <ScenarioField
              label="Chemicals ($/acre)"
              fieldKey="chemicals"
              values={scenarioValues}
              onChange={handleChange}
              peerHint={`Peer: ${formatMoney(m.chemicals.low)}–${formatMoney(m.chemicals.high)} · median ${formatMoney(m.chemicals.median)}`}
            />
            <ScenarioField
              label="Other ($/acre)"
              fieldKey="other"
              values={scenarioValues}
              onChange={handleChange}
            />
            <ScenarioField
              label={`Expected Yield (${benchmark.yieldUnit})`}
              fieldKey="yieldPerAcre"
              values={scenarioValues}
              onChange={handleChange}
              peerHint={`Peer: ${formatNumber(m.expectedYield.low)}–${formatNumber(m.expectedYield.high)} · median ${formatNumber(m.expectedYield.median)}`}
            />
            <ScenarioField
              label={`Crop Price (${benchmark.priceUnit})`}
              fieldKey="cropPrice"
              values={scenarioValues}
              onChange={handleChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base">Category Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left p-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Category</th>
                <th className="text-right p-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Your Scenario</th>
                <th className="text-right p-4 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Peer Median</th>
                <th className="text-right p-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                { label: "Seed", value: formatMoney(scenarioValues.seed) + "/acre", median: formatMoney(m.seed.median) + "/acre", cmp: result.comparisons.seed },
                { label: "Fertilizer", value: formatMoney(scenarioValues.fertilizer) + "/acre", median: formatMoney(m.fertilizer.median) + "/acre", cmp: result.comparisons.fertilizer },
                { label: "Chemicals", value: formatMoney(scenarioValues.chemicals) + "/acre", median: formatMoney(m.chemicals.median) + "/acre", cmp: result.comparisons.chemicals },
                { label: "Total Input Cost", value: formatMoney(result.totalInputCost) + "/acre", median: formatMoney(m.totalInputCost.median) + "/acre", cmp: result.comparisons.totalInputCost },
                { label: "Projected Margin", value: formatMoney(result.marginPerAcre) + "/acre", median: formatMoney(m.margin.median) + "/acre", cmp: result.comparisons.margin },
              ].map(({ label, value, median, cmp }) => (
                <tr key={label} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-medium">{label}</td>
                  <td className="p-4 text-right font-mono font-semibold">{value}</td>
                  <td className="p-4 text-right text-muted-foreground hidden md:table-cell">{median}</td>
                  <td className="p-4 text-right">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneBadgeClass(cmp.tone)}`}>
                      {cmp.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Based on USDA ERS Iowa production cost data · {benchmark.sampleLabel} · For planning purposes only
      </p>
    </div>
  );
}
