import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, locationsTable, alertsTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { fetchCurrentWeather, fetchForecast } from "../lib/weather";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser((req as any).clerkUserId, email);

  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let location;
  if (params.data.locationId) {
    const [loc] = await db.select().from(locationsTable)
      .where(and(eq(locationsTable.id, params.data.locationId), eq(locationsTable.userId, user.id)));
    location = loc;
  } else {
    const [defaultLoc] = await db.select().from(locationsTable)
      .where(and(eq(locationsTable.userId, user.id), eq(locationsTable.isDefault, true)));
    if (!defaultLoc) {
      const [firstLoc] = await db.select().from(locationsTable).where(eq(locationsTable.userId, user.id)).limit(1);
      location = firstLoc;
    } else {
      location = defaultLoc;
    }
  }

  if (!location) {
    res.status(200).json({
      currentWeather: {
        temperature: 72, feelsLike: 70, humidity: 55, windSpeed: 8, windGust: 12,
        cloudCover: 20, precipitation: 0, uvIndex: 5, weatherCode: 1,
        weatherDescription: "Mainly clear", isDay: true, updatedAt: new Date().toISOString(),
      },
      todayForecast: {
        date: new Date().toISOString().split("T")[0],
        tempMax: 78, tempMin: 62, feelsLikeMax: 76, feelsLikeMin: 60,
        precipitation: 0, precipitationProbability: 10, windSpeedMax: 12, windGustMax: 18,
        cloudCover: 20, uvIndexMax: 7, sunrise: "6:30 AM", sunset: "7:45 PM",
        weatherCode: 1, weatherDescription: "Mainly clear",
      },
      activeAlertCount: 0,
      activeAlerts: [],
      upcomingExtremes: [],
      weeklyPrecipitation: 0,
      weeklyTempRange: { min: 58, max: 82 },
    });
    return;
  }

  const [currentWeather, forecast] = await Promise.all([
    fetchCurrentWeather(location.lat, location.lng),
    fetchForecast(location.lat, location.lng),
  ]);

  const todayForecast = forecast[0];
  const next7 = forecast.slice(0, 7);

  const activeAlerts = await db.select().from(alertsTable)
    .where(and(eq(alertsTable.userId, user.id), eq(alertsTable.isRead, false)))
    .orderBy(desc(alertsTable.triggeredAt))
    .limit(5);

  type ForecastDay = (typeof forecast)[number];
  const weeklyPrecipitation = next7.reduce((sum: number, d: ForecastDay) => sum + (d.precipitation ?? 0), 0);
  const weeklyTempRange = {
    min: Math.min(...next7.map((d: ForecastDay) => d.tempMin)),
    max: Math.max(...next7.map((d: ForecastDay) => d.tempMax)),
  };

  const upcomingExtremes: any[] = [];
  forecast.slice(0, 15).forEach((d: ForecastDay) => {
    if (d.tempMin <= 28) upcomingExtremes.push({ type: "hard_freeze", date: d.date, severity: "critical", description: `Hard freeze: ${d.tempMin}°F` });
    else if (d.tempMin <= 32) upcomingExtremes.push({ type: "frost", date: d.date, severity: "warning", description: `Frost risk: ${d.tempMin}°F` });
    if (d.tempMax >= 100) upcomingExtremes.push({ type: "extreme_heat", date: d.date, severity: "critical", description: `Extreme heat: ${d.tempMax}°F` });
    if (d.precipitation >= 3) upcomingExtremes.push({ type: "heavy_precipitation", date: d.date, severity: "warning", description: `Heavy rain: ${d.precipitation}"` });
    if (d.windSpeedMax >= 55) upcomingExtremes.push({ type: "high_wind", date: d.date, severity: "critical", description: `Dangerous wind: ${d.windSpeedMax} mph` });
  });

  res.json(GetDashboardSummaryResponse.parse({
    location,
    currentWeather,
    todayForecast,
    activeAlertCount: activeAlerts.length,
    activeAlerts,
    upcomingExtremes: upcomingExtremes.slice(0, 10),
    weeklyPrecipitation: Math.round(weeklyPrecipitation * 100) / 100,
    weeklyTempRange,
  }));
});

export default router;
