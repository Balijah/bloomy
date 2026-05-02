import { useParams, Link } from "wouter";
import { 
  useGetFarmProfile,
  useGetAgricultureInsights,
  getGetFarmProfileQueryKey,
  getGetAgricultureInsightsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sprout, AlertTriangle, Droplets, Thermometer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AgricultureDetails() {
  const params = useParams();
  const id = params.id ? parseInt(params.id) : 0;

  const { data: profile, isLoading: isProfileLoading } = useGetFarmProfile(id, {
    query: { enabled: !!id, queryKey: getGetFarmProfileQueryKey(id) }
  });
  
  const { data: insights, isLoading: isInsightsLoading } = useGetAgricultureInsights(id, {
    query: { enabled: !!id, queryKey: getGetAgricultureInsightsQueryKey(id) }
  });

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
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-amber-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/agriculture" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-agriculture">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fields
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
          <Badge variant="secondary" className="capitalize text-sm px-3 py-1">
            {profile.cropType.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Stats */}
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
                  {insights.frostRisk?.level ?? 'Unknown'}
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
                  {insights.heatStressRisk?.level ?? 'Unknown'}
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
                  {insights.droughtRisk?.level ?? 'Unknown'}
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
                  {insights.harvestDisruptionRisk?.level ?? 'Unknown'}
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

        {/* Moisture & Soil */}
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Soil & Moisture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Soil Moisture</span>
                <span className="font-medium" data-testid="text-soil-moisture">
                  {insights.soilMoisture != null ? `${insights.soilMoisture}%` : 'N/A'}
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
                  {insights.evapotranspiration7Day != null ? `${insights.evapotranspiration7Day} in` : 'N/A'}
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
    </div>
  );
}
