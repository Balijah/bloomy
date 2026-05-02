import { Router, type IRouter } from "express";
import {
  GetCurrentWeatherQueryParams,
  GetCurrentWeatherResponse,
  GetForecastQueryParams,
  GetForecastResponse,
  GetHourlyForecastQueryParams,
  GetHourlyForecastResponse,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchCurrentWeather, fetchForecast, fetchHourlyForecast } from "../lib/weather";

const router: IRouter = Router();

router.get("/weather/current", async (req, res): Promise<void> => {
  const parsed = GetCurrentWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const weather = await fetchCurrentWeather(parsed.data.lat, parsed.data.lng);
  res.json(GetCurrentWeatherResponse.parse(weather));
});

router.get("/weather/forecast", async (req, res): Promise<void> => {
  const parsed = GetForecastQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const forecast = await fetchForecast(parsed.data.lat, parsed.data.lng);
  res.json(GetForecastResponse.parse(forecast));
});

router.get("/weather/hourly", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const clerkUserId = (req as any).clerkUserId;
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser(clerkUserId, email);

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, user.id)).limit(1);
  if (!sub || sub.tier === "free") {
    res.status(403).json({ error: "Paid tier required for hourly forecasts" });
    return;
  }

  const parsed = GetHourlyForecastQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hourly = await fetchHourlyForecast(parsed.data.lat, parsed.data.lng);
  res.json(GetHourlyForecastResponse.parse(hourly));
});

export default router;
