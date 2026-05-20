import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetFarmProfile,
  useGetAgricultureInsights,
  useGetInputCosts,
  useCreateInputCost,
  useDeleteInputCost,
  getGetFarmProfileQueryKey,
  getGetAgricultureInsightsQueryKey,
  getGetInputCostsQueryKey,
  InputCostCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Sprout, AlertTriangle, Droplets, Thermometer, CheckCircle2, Plus, Trash2, DollarSign } from "lucide-react";
import BenchmarkPlannerSection from "@/components/benchmark-planner-section";
import { effectiveCostPerAcre, formatMoney } from "@/lib/benchmarkPlanner";

const ALL_CATEGORIES = Object.values(InputCostCategory);

const USDA_HINTS: Partial<Record<string, number>> = {
  seed: 118,
  fertilizer: 205,
  herbicide: 48,
  pesticide: 24,
  fuel: 32,
  labor: 28,
};

const addCostSchema = z.object({
  category: z.enum(ALL_CATEGORIES as [string, ...string[]]),
  item: z.string().min(1, "Description is required"),
  mode: z.enum(["per_acre", "total"]),
  costPerAcre: z.coerce.number().optional(),
  totalCost: z.coerce.number().optional(),
  acresApplied: z.coerce.number().optional(),
});

type AddCostForm = z.infer<typeof addCostSchema>;

export default function AgricultureDetails() {
  const params = useParams();
  const id = params.id ? parseInt(params.id) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: profile, isLoading: isProfileLoading } = useGetFarmProfile(id, {
    query: { enabled: !!id, queryKey: getGetFarmProfileQueryKey(id) },
  });

  const { data: insights, isLoading: isInsightsLoading } = useGetAgricultureInsights(id, {
    query: { enabled: !!id, queryKey: getGetAgricultureInsightsQueryKey(id) },
  });

  const { data: inputCosts = [] } = useGetInputCosts(id, {
    query: { enabled: !!id, queryKey: getGetInputCostsQueryKey(id) },
  });

  const createCost = useCreateInputCost();
  const deleteCost = useDeleteInputCost();

  const form = useForm<AddCostForm>({
    resolver: zodResolver(addCostSchema),
    defaultValues: { category: "seed", item: "", mode: "per_acre" },
  });

  const watchMode = form.watch("mode");
  const watchCategory = form.watch("category");

  const onSubmit = (values: AddCostForm) => {
    const payload =
      values.mode === "per_acre"
        ? { category: values.category as typeof InputCostCategory[keyof typeof InputCostCategory], item: values.item, costPerAcre: values.costPerAcre }
        : { category: values.category as typeof InputCostCategory[keyof typeof InputCostCategory], item: values.item, totalCost: values.totalCost, acresApplied: values.acresApplied };

    createCost.mutate({ id, data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInputCostsQueryKey(id) });
        setIsAddOpen(false);
        form.reset({ category: "seed", item: "", mode: "per_acre" });
        toast({ title: "Expense added" });
      },
      onError: () => toast({ title: "Failed to add expense", variant: "destructive" }),
    });
  };

  const handleDelete = (costId: number) => {
    deleteCost.mutate({ id, costId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInputCostsQueryKey(id) });
        toast({ title: "Expense removed" });
      },
    });
  };

  const isLoading = isProfileLoading || isInsightsLoading;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full rounded-xl md:col-span-2" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile || !insights) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Farm profile not found</h2>
          <p className="text-muted-foreground mb-6">This profile may have been deleted or you don't have access to it.</p>
          <Link href="/agriculture">
            <Button data-testid="button-back-to-agriculture">Back to Fields</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getRiskColor = (level: string | undefined) => {
    switch (level?.toLowerCase()) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-orange-500 text-white";
      case "moderate": return "bg-amber-500 text-white";
      case "low": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Group input costs by category
  const grouped = ALL_CATEGORIES.reduce<Record<string, typeof inputCosts>>((acc, cat) => {
    acc[cat] = inputCosts.filter((c) => c.category === cat);
    return acc;
  }, {});
  const nonEmptyCategories = ALL_CATEGORIES.filter((cat) => grouped[cat].length > 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/agriculture" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-agriculture">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fields
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
          <Badge variant="secondary" className="capitalize text-sm px-3 py-1">
            {profile.cropType.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* GDD */}
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-primary" /> Growing Degree Days (GDD)
            </CardTitle>
            <CardDescription>Accumulated heat units for {profile.cropType}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col justify-center min-h-[200px]">
            <div className="text-center">
              <span className="text-6xl font-bold text-primary tracking-tighter" data-testid="text-gdd-forecast">
                {insights.growingDegreeDaysForecast ?? "N/A"}
              </span>
              <p className="text-muted-foreground mt-2 font-medium">Forecasted Heat Units (15 days)</p>
            </div>
          </CardContent>
        </Card>

        {/* Risks */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              <div className="p-4 flex items-center justify-between" data-testid="risk-frost">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Thermometer className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Frost Risk</span>
                </div>
                <Badge className={getRiskColor(insights.frostRisk?.level)}>
                  {insights.frostRisk?.level ?? "Unknown"}
                </Badge>
              </div>
              <div className="p-4 flex items-center justify-between" data-testid="risk-heat">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Thermometer className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Heat Stress</span>
                </div>
                <Badge className={getRiskColor(insights.heatStressRisk?.level)}>
                  {insights.heatStressRisk?.level ?? "Unknown"}
                </Badge>
              </div>
              <div className="p-4 flex items-center justify-between" data-testid="risk-drought">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-700/10 text-amber-700 flex items-center justify-center">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Drought Risk</span>
                </div>
                <Badge className={getRiskColor(insights.droughtRisk?.level)}>
                  {insights.droughtRisk?.level ?? "Unknown"}
                </Badge>
              </div>
              <div className="p-4 flex items-center justify-between" data-testid="risk-harvest">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 text-green-700 flex items-center justify-center">
                    <Sprout className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Harvest Risk</span>
                </div>
                <Badge className={getRiskColor(insights.harvestDisruptionRisk?.level)}>
                  {insights.harvestDisruptionRisk?.level ?? "Unknown"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Agronomic Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {insights.recommendations && insights.recommendations.length > 0 ? (
              <ul className="space-y-4">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 bg-muted/30 p-4 rounded-lg" data-testid={`recommendation-${i}`}>
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground italic">No specific recommendations at this time.</p>
            )}
          </CardContent>
        </Card>

        {/* Soil & Moisture */}
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Soil & Moisture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Soil Moisture</span>
                <span className="font-medium" data-testid="text-soil-moisture">
                  {insights.soilMoisture != null ? `${insights.soilMoisture}%` : "N/A"}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, insights.soilMoisture ?? 0))}%` }}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-border/50">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-muted-foreground">7-Day ET</span>
                <span className="font-medium" data-testid="text-evapotranspiration">
                  {insights.evapotranspiration7Day != null ? `${insights.evapotranspiration7Day} in` : "N/A"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Estimated water loss</p>
            </div>
            {insights.precipitationForecast != null && (
              <div className="pt-4 border-t border-border/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">7-Day Precip Forecast</span>
                  <span className="font-medium" data-testid="text-precip-forecast">{insights.precipitationForecast} in</span>
                </div>
              </div>
            )}
            {insights.nextFrostDate && (
              <div className="pt-4 border-t border-border/50 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Next Frost Date</span>
                  <span className="font-medium text-blue-600" data-testid="text-next-frost">{insights.nextFrostDate}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Input Cost Section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Input Costs
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track your seed, fertilizer, chemical, and other expenses per acre.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full gap-2">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Add Input Cost</DialogTitle>
                <DialogDescription>Log a seed, fertilizer, chemical, or other farm expense.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ALL_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} className="capitalize">{cat.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="item" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Pioneer P1197AM, Roundup PowerMax" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="mode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Mode</FormLabel>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={field.value === "per_acre" ? "default" : "outline"}
                          onClick={() => field.onChange("per_acre")}
                        >Per acre</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={field.value === "total" ? "default" : "outline"}
                          onClick={() => field.onChange("total")}
                        >Total spend</Button>
                      </div>
                    </FormItem>
                  )} />
                  {watchMode === "per_acre" ? (
                    <FormField control={form.control} name="costPerAcre" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost per Acre ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder={USDA_HINTS[watchCategory] ? `e.g. ${USDA_HINTS[watchCategory]} (Iowa avg)` : "0.00"}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="totalCost" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Cost ($)</FormLabel>
                          <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="acresApplied" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Acres Applied</FormLabel>
                          <FormControl><Input type="number" min={0} step={0.1} placeholder={String(profile.acreage ?? "")} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                  <DialogFooter className="pt-2">
                    <Button type="submit" disabled={createCost.isPending}>
                      {createCost.isPending ? "Saving..." : "Save Expense"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {inputCosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center flex flex-col items-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">No input costs logged yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add expenses to see how they compare to Iowa peer benchmarks</p>
          </div>
        ) : (
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {nonEmptyCategories.map((cat, idx) => {
                const items = grouped[cat];
                const subtotal = items.reduce((sum, item) => {
                  const v = effectiveCostPerAcre(item, profile.acreage);
                  return sum + (v ?? 0);
                }, 0);
                return (
                  <div key={cat} className={idx > 0 ? "border-t border-border/50" : ""}>
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                        {cat.replace("_", " ")}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">{formatMoney(subtotal)}/acre</span>
                    </div>
                    {items.map((item) => {
                      const perAcre = effectiveCostPerAcre(item, profile.acreage);
                      return (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 group border-t border-border/30">
                          <span className="text-sm">{item.item}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono font-medium">
                              {perAcre != null ? `${formatMoney(perAcre)}/ac` : item.totalCost != null ? `${formatMoney(item.totalCost)} total` : "—"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Benchmark Planner Section ── */}
      <BenchmarkPlannerSection profile={profile} inputCosts={inputCosts} />
    </div>
  );
}
