import { logger } from "./logger";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Icy fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Heavy drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers", 81: "Moderate showers", 82: "Heavy showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "Unknown";
}

function mmToInches(mm: number): number {
  return Math.round((mm / 25.4) * 100) / 100;
}

function cToF(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

function kmhToMph(kmh: number): number {
  return Math.round((kmh * 0.621371) * 10) / 10;
}

export async function fetchCurrentWeather(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    current: [
      "temperature_2m", "apparent_temperature", "relative_humidity_2m",
      "wind_speed_10m", "wind_gusts_10m", "cloud_cover",
      "precipitation", "uv_index", "weather_code", "is_day", "visibility"
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json() as any;
  const c = data.current;

  return {
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    windGust: c.wind_gusts_10m,
    cloudCover: c.cloud_cover,
    precipitation: c.precipitation,
    uvIndex: c.uv_index,
    visibility: c.visibility ? c.visibility / 1000 : 10,
    weatherCode: c.weather_code,
    weatherDescription: wmoDescription(c.weather_code),
    isDay: c.is_day === 1,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchForecast(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    daily: [
      "temperature_2m_max", "temperature_2m_min",
      "apparent_temperature_max", "apparent_temperature_min",
      "precipitation_sum", "precipitation_probability_max",
      "wind_speed_10m_max", "wind_gusts_10m_max",
      "cloud_cover_mean", "uv_index_max",
      "sunrise", "sunset", "weather_code",
      "soil_temperature_0cm", "soil_moisture_0_to_1cm",
      "et0_fao_evapotranspiration",
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "15",
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json() as any;
  const d = data.daily;

  return d.time.map((date: string, i: number) => ({
    date,
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    feelsLikeMax: d.apparent_temperature_max[i],
    feelsLikeMin: d.apparent_temperature_min[i],
    precipitation: d.precipitation_sum[i] ?? 0,
    precipitationProbability: d.precipitation_probability_max[i] ?? 0,
    windSpeedMax: d.wind_speed_10m_max[i] ?? 0,
    windGustMax: d.wind_gusts_10m_max[i] ?? 0,
    cloudCover: d.cloud_cover_mean[i] ?? 0,
    uvIndexMax: d.uv_index_max[i] ?? 0,
    sunrise: d.sunrise[i] ?? "",
    sunset: d.sunset[i] ?? "",
    weatherCode: d.weather_code[i] ?? 0,
    weatherDescription: wmoDescription(d.weather_code[i] ?? 0),
    soilTemperature: d.soil_temperature_0cm ? cToF(d.soil_temperature_0cm[i]) : null,
    soilMoisture: d.soil_moisture_0_to_1cm ? d.soil_moisture_0_to_1cm[i] : null,
    evapotranspiration: d.et0_fao_evapotranspiration ? d.et0_fao_evapotranspiration[i] : null,
  }));
}

export async function fetchHourlyForecast(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: [
      "temperature_2m", "apparent_temperature",
      "precipitation", "precipitation_probability",
      "wind_speed_10m", "wind_gusts_10m",
      "relative_humidity_2m", "cloud_cover",
      "weather_code", "is_day",
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "2",
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json() as any;
  const h = data.hourly;

  return h.time.map((time: string, i: number) => ({
    time,
    temperature: h.temperature_2m[i],
    feelsLike: h.apparent_temperature[i],
    precipitation: h.precipitation[i] ?? 0,
    precipitationProbability: h.precipitation_probability[i] ?? 0,
    windSpeed: h.wind_speed_10m[i] ?? 0,
    windGust: h.wind_gusts_10m[i] ?? 0,
    humidity: h.relative_humidity_2m[i] ?? 0,
    cloudCover: h.cloud_cover[i] ?? 0,
    weatherCode: h.weather_code[i] ?? 0,
    weatherDescription: wmoDescription(h.weather_code[i] ?? 0),
    isDay: h.is_day[i] === 1,
  }));
}

export function computeAgricultureInsights(
  forecast: ReturnType<typeof fetchForecast> extends Promise<infer T> ? T : never,
  cropType: string,
) {
  const next15 = forecast.slice(0, 15);
  const next7 = forecast.slice(0, 7);

  const gddBase: Record<string, number> = {
    corn: 50, soybeans: 50, winter_wheat: 32, cotton: 60,
    almonds: 50, grapes: 50, apples: 43, potatoes: 45, rice: 60, other: 50,
  };
  const base = gddBase[cropType] ?? 50;

  const gddForecast = next15.reduce((sum: number, d: any) => {
    const gdd = Math.max(0, ((d.tempMax + d.tempMin) / 2) - base);
    return sum + gdd;
  }, 0);

  const precipForecast = next7.reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0);
  const precipLast14 = next15.reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0) / 2;
  const avgMonthlyPrecip = 1.5;
  const precipDeficit = Math.max(0, avgMonthlyPrecip - precipLast14);

  const minTemps = next15.map((d: any) => d.tempMin);
  const maxTemps = next15.map((d: any) => d.tempMax);
  const maxWind = Math.max(...next15.map((d: any) => d.windSpeedMax));
  const maxPrecip24h = Math.max(...next15.map((d: any) => d.precipitation));

  const frostDays = next15.filter((d: any) => d.tempMin <= 32);
  const hardFreezeDays = next15.filter((d: any) => d.tempMin <= 28);
  const heatDays = next15.filter((d: any) => d.tempMax >= 95);
  const heavyRainDays = next15.filter((d: any) => d.precipitation >= 2);

  const frostRisk = hardFreezeDays.length > 0
    ? { level: "critical", description: `Hard freeze (≤28°F) expected on ${hardFreezeDays.length} day(s)` }
    : frostDays.length > 0
    ? { level: "high", description: `Frost risk on ${frostDays.length} day(s) in the next 15 days` }
    : { level: "none", description: "No frost risk in the next 15 days" };

  const heatStressRisk = heatDays.length >= 3
    ? { level: "critical", description: `${heatDays.length} days above 95°F — crop stress likely` }
    : heatDays.length > 0
    ? { level: "moderate", description: `${heatDays.length} days above 95°F expected` }
    : { level: "none", description: "No heat stress risk in the next 15 days" };

  const droughtRisk = precipDeficit > 1.5
    ? { level: "high", description: `${precipDeficit.toFixed(1)}" precipitation deficit over 14 days` }
    : precipDeficit > 0.5
    ? { level: "moderate", description: `${precipDeficit.toFixed(1)}" below average precipitation` }
    : { level: "none", description: "Adequate precipitation levels" };

  const harvestDisruptionRisk = heavyRainDays.length >= 2
    ? { level: "high", description: `Heavy rain on ${heavyRainDays.length} day(s) may delay field operations` }
    : heavyRainDays.length > 0
    ? { level: "moderate", description: "Some heavy rain events may impact field access" }
    : { level: "none", description: "No harvest disruption risk" };

  const extremeEvents: any[] = [];
  next15.forEach((d: any) => {
    if (d.tempMin <= 28) extremeEvents.push({ type: "hard_freeze", date: d.date, severity: "critical", description: `Hard freeze: ${d.tempMin}°F` });
    else if (d.tempMin <= 32) extremeEvents.push({ type: "frost", date: d.date, severity: "warning", description: `Frost risk: ${d.tempMin}°F` });
    if (d.tempMax >= 100) extremeEvents.push({ type: "extreme_heat", date: d.date, severity: "critical", description: `Extreme heat: ${d.tempMax}°F` });
    else if (d.tempMax >= 95) extremeEvents.push({ type: "heat_stress", date: d.date, severity: "warning", description: `Heat stress: ${d.tempMax}°F` });
    if (d.precipitation >= 3) extremeEvents.push({ type: "heavy_precipitation", date: d.date, severity: "warning", description: `Heavy rain: ${d.precipitation}"` });
    if (d.windSpeedMax >= 55) extremeEvents.push({ type: "high_wind", date: d.date, severity: "critical", description: `Dangerous wind: ${d.windSpeedMax} mph` });
    else if (d.windSpeedMax >= 35) extremeEvents.push({ type: "high_wind", date: d.date, severity: "warning", description: `High wind: ${d.windSpeedMax} mph` });
  });

  const nextFrostDate = frostDays.length > 0 ? frostDays[0].date : null;
  const soilMoisture = next15[0]?.soilMoisture ?? null;
  const evapotranspiration7Day = next7.reduce((s: number, d: any) => s + (d.evapotranspiration ?? 0), 0) || null;

  const recommendations: string[] = [];
  if (frostRisk.level !== "none") recommendations.push("Consider frost protection measures for sensitive crops.");
  if (heatStressRisk.level !== "none") recommendations.push("Increase irrigation frequency during heat events.");
  if (droughtRisk.level !== "none") recommendations.push("Monitor soil moisture closely and plan irrigation.");
  if (harvestDisruptionRisk.level !== "none") recommendations.push("Plan field operations around dry windows to avoid harvest delays.");
  if (recommendations.length === 0) recommendations.push("Conditions look favorable for the next 15 days.");

  const precipitationDaily = next7.map((d: any) => ({
    date: d.date,
    precipitation: Math.round(d.precipitation * 100) / 100,
    precipitationProbability: d.precipitationProbability ?? 0,
  }));

  return {
    cropType,
    growingDegreeDays: 0,
    growingDegreeDaysForecast: Math.round(gddForecast),
    frostRisk,
    heatStressRisk,
    droughtRisk,
    harvestDisruptionRisk,
    precipitationDeficit: Math.round(precipDeficit * 100) / 100,
    precipitationForecast: Math.round(precipForecast * 100) / 100,
    precipitationDaily,
    soilMoisture,
    evapotranspiration7Day: evapotranspiration7Day ? Math.round(evapotranspiration7Day * 100) / 100 : null,
    nextFrostDate,
    recommendations,
    extremeEventsNext15Days: extremeEvents,
    updatedAt: new Date().toISOString(),
  };
}
