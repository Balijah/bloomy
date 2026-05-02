import { useGetDashboardSummary, useGetMe, useGetHourlyForecast, useGetForecast, getGetHourlyForecastQueryKey, getGetForecastQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Cloud, Droplets, Wind, ThermometerSun, Sun, CloudRain, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();

  const hasLocation = !!summary?.location;
  const lat = summary?.location?.lat ?? 0;
  const lng = summary?.location?.lng ?? 0;

  const { data: hourly, isLoading: isHourlyLoading } = useGetHourlyForecast(
    { lat, lng },
    { query: { enabled: hasLocation, queryKey: getGetHourlyForecastQueryKey({ lat, lng }) } }
  );

  const { data: forecast, isLoading: isForecastLoading } = useGetForecast(
    { lat, lng },
    { query: { enabled: hasLocation, queryKey: getGetForecastQueryKey({ lat, lng }) } }
  );

  const isLoading = isUserLoading || isSummaryLoading;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!summary || !summary.location) {
    return (
      <div className="p-6 md:p-8 text-center max-w-2xl mx-auto mt-20">
        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <Cloud className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-bold mb-4">No location set</h2>
        <p className="text-lg text-muted-foreground mb-8">Add a location to see your hyper-local weather dashboard.</p>
        <Link href="/locations" className="inline-flex items-center justify-center rounded-full bg-primary px-8 h-12 text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          Add Location
        </Link>
      </div>
    );
  }

  const current = summary.currentWeather;
  const activeAlerts = summary.activeAlerts || [];
  const isFree = user?.subscriptionTier === "free";

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            Good morning, {user?.firstName || 'Grower'}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            Live conditions for {summary.location.name}
          </p>
        </div>
        <div className="text-right text-sm font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
          {format(new Date(), 'EEEE, MMMM do')}
        </div>
      </div>

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Active Weather Alerts ({activeAlerts.length})</h3>
            <p className="text-destructive/90 text-sm mt-1">
              {activeAlerts[0].title} — {activeAlerts[0].message}
            </p>
          </div>
          <Link href="/alerts" className="text-sm font-medium text-destructive hover:underline shrink-0">
            View All
          </Link>
        </div>
      )}

      {/* Current Conditions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-card hover:bg-muted/30 transition-colors" data-testid="card-temperature">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Temperature</p>
                <div className="text-4xl font-bold tracking-tight">{Math.round(current?.temperature ?? 0)}°</div>
                <p className="text-sm text-muted-foreground mt-2">Feels like {Math.round(current?.feelsLike ?? 0)}°</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <ThermometerSun className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover:bg-muted/30 transition-colors" data-testid="card-precipitation">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Precipitation</p>
                <div className="text-3xl font-bold tracking-tight mt-1">{(current?.precipitation ?? 0).toFixed(2)}<span className="text-xl font-normal text-muted-foreground ml-1">in</span></div>
                <p className="text-sm text-muted-foreground mt-2">Cloud cover: {current?.cloudCover ?? 0}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <CloudRain className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover:bg-muted/30 transition-colors" data-testid="card-wind">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Wind</p>
                <div className="text-3xl font-bold tracking-tight mt-1">{Math.round(current?.windSpeed ?? 0)}<span className="text-xl font-normal text-muted-foreground ml-1">mph</span></div>
                <p className="text-sm text-muted-foreground mt-2">Gusts up to {Math.round(current?.windGust ?? 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                <Wind className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card hover:bg-muted/30 transition-colors" data-testid="card-conditions">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Conditions</p>
                <div className="text-xl font-bold tracking-tight mt-2 leading-tight capitalize">{current?.weatherDescription ?? ""}</div>
                <p className="text-sm text-muted-foreground mt-2">Humidity: {current?.humidity ?? 0}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Sun className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="hourly" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
          <TabsTrigger value="hourly" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            Hourly Forecast
          </TabsTrigger>
          <TabsTrigger value="daily" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
            15-Day Outlook
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="hourly" className="m-0">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Next 24 Hours</CardTitle>
              {isFree && <CardDescription>Upgrade to Grower for hourly resolution.</CardDescription>}
            </CardHeader>
            <CardContent>
              {isHourlyLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : hourly && hourly.length > 0 ? (
                <ScrollArea className="w-full pb-4">
                  <div className="flex w-max min-w-full space-x-2">
                    {hourly.slice(0, 24).map((h, i) => (
                      <div key={i} className="flex flex-col items-center justify-between p-4 rounded-xl hover:bg-muted/50 min-w-[80px] transition-colors" data-testid={`hourly-item-${i}`}>
                        <span className="text-sm font-medium text-muted-foreground mb-3">
                          {format(parseISO(h.time), "ha")}
                        </span>
                        <div className="h-8 w-8 text-primary mb-3">
                          {h.precipitation > 0 ? <CloudRain /> : <Sun />}
                        </div>
                        <span className="text-lg font-bold">{Math.round(h.temperature)}°</span>
                        {h.precipitationProbability > 0 && (
                          <span className="text-xs text-blue-500 font-medium mt-2 flex items-center gap-1">
                            <Droplets className="h-3 w-3" /> {h.precipitationProbability}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              ) : isFree ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">Hourly forecasts require a paid plan.</p>
                  <Link href="/subscription">
                    <Button variant="outline" size="sm" className="rounded-full" data-testid="button-upgrade-hourly">Upgrade to Grower</Button>
                  </Link>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Forecast data unavailable</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="daily" className="m-0">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20 border-b">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Daily Outlook</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isForecastLoading ? (
                <Skeleton className="h-64 w-full m-6" />
              ) : forecast && forecast.length > 0 ? (
                <div className="divide-y">
                  {(isFree ? forecast.slice(0, 7) : forecast).map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors" data-testid={`forecast-day-${i}`}>
                      <div className="w-24 sm:w-32 shrink-0">
                        <div className="font-medium">{i === 0 ? 'Today' : format(parseISO(d.date), "EEE")}</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(d.date), "MMM d")}</div>
                      </div>
                      
                      <div className="flex-1 flex justify-center">
                        <div className="flex items-center gap-2 w-32 justify-center">
                          {d.precipitationProbability > 20 ? (
                            <CloudRain className="h-5 w-5 text-blue-500" />
                          ) : d.cloudCover > 50 ? (
                            <Cloud className="h-5 w-5 text-slate-400" />
                          ) : (
                            <Sun className="h-5 w-5 text-amber-500" />
                          )}
                          <span className="text-sm font-medium w-12 text-center">
                            {d.precipitationProbability > 0 ? `${d.precipitationProbability}%` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="w-32 flex justify-end items-center gap-4">
                        <span className="text-muted-foreground font-medium">{Math.round(d.tempMin)}°</span>
                        <div className="w-16 h-1.5 bg-gradient-to-r from-blue-400 via-amber-400 to-orange-500 rounded-full hidden sm:block opacity-70"></div>
                        <span className="font-bold text-foreground">{Math.round(d.tempMax)}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">Forecast data unavailable</div>
              )}
              {isFree && forecast && forecast.length > 7 && (
                <div className="p-6 bg-muted/20 border-t text-center">
                  <p className="text-sm text-muted-foreground mb-3">Upgrade to Grower to see the full 15-day outlook</p>
                  <Link href="/subscription">
                    <Button variant="outline" size="sm" className="rounded-full" data-testid="button-upgrade-forecast">View Plans</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
