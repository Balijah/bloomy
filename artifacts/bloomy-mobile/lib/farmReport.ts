/**
 * Farm report HTML generator.
 * Produces a self-contained, PDF-friendly HTML document from farm + insights data.
 * Uses only inline styles and system fonts so expo-print can render it without
 * network requests.
 */

// ── colour palette (mirrors Bloomy brand) ────────────────────────────────────
const PRIMARY   = "#366441";
const BG        = "#FAF8F5";
const CARD      = "#FFFFFF";
const BORDER    = "#E8E0CE";
const MUTED     = "#6E736E";
const TEXT      = "#232A23";

// ── risk colours ─────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#FEE2E2", text: "#DC2626" },
  high:     { bg: "#FFEDD5", text: "#EA580C" },
  moderate: { bg: "#FEF9C3", text: "#CA8A04" },
  low:      { bg: "#DCFCE7", text: "#16A34A" },
  none:     { bg: "#F3F4F6", text: "#6B7280" },
};

// ── UV colours ───────────────────────────────────────────────────────────────
function uvColor(uv: number) {
  if (uv >= 11) return { bg: "#F3E8FF", text: "#7C3AED" };
  if (uv >= 8)  return { bg: "#FEE2E2", text: "#DC2626" };
  if (uv >= 6)  return { bg: "#FFEDD5", text: "#EA580C" };
  if (uv >= 3)  return { bg: "#FEF9C3", text: "#CA8A04" };
  return              { bg: "#DCFCE7", text: "#16A34A" };
}
function uvLabel(uv: number) {
  if (uv >= 11) return "Extreme";
  if (uv >= 8)  return "Very High";
  if (uv >= 6)  return "High";
  if (uv >= 3)  return "Moderate";
  return              "Low";
}

// ── wind colours ─────────────────────────────────────────────────────────────
function windColor(mph: number) {
  if (mph >= 35) return { bg: "#FFEDD5", text: "#EA580C" };
  if (mph >= 15) return { bg: "#FEF9C3", text: "#CA8A04" };
  return              { bg: "#DCFCE7", text: "#16A34A" };
}
function windLabel(mph: number) {
  if (mph >= 55) return "Dangerous";
  if (mph >= 35) return "High wind";
  if (mph >= 15) return "Windy";
  return              "Calm";
}

// ── helpers ───────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(raw: Date | string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw as any);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtShort(raw: Date | string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw as any);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(raw: Date | string): string {
  const d = new Date(raw as any);
  if (isNaN(d.getTime())) return "—";
  const today = new Date().toDateString() === d.toDateString();
  return today ? "Today" : DAY_LABELS[d.getDay()];
}

function capitalize(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function badge(text: string, bg: string, color: string) {
  return `<span style="
    display:inline-block;
    padding:2px 8px;
    border-radius:999px;
    background:${bg};
    color:${color};
    font-size:11px;
    font-weight:600;
    letter-spacing:.3px;
  ">${text}</span>`;
}

function sectionTitle(label: string) {
  return `
    <div style="
      font-size:10px;
      font-weight:700;
      letter-spacing:1.2px;
      text-transform:uppercase;
      color:${MUTED};
      margin:20px 0 8px;
      padding-bottom:4px;
      border-bottom:1px solid ${BORDER};
    ">${label}</div>`;
}

function riskRow(
  label: string,
  level: string | undefined,
  description: string | undefined
) {
  const lvl = (level ?? "none").toLowerCase();
  const c = RISK_COLORS[lvl] ?? RISK_COLORS.none;
  return `
    <tr>
      <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};">${label}</td>
      <td style="padding:7px 10px;border-bottom:1px solid ${BORDER};">
        ${badge(capitalize(lvl), c.bg, c.text)}
      </td>
      <td style="padding:7px 10px;font-size:11px;color:${MUTED};border-bottom:1px solid ${BORDER};">${description ?? "—"}</td>
    </tr>`;
}

// ── main export ───────────────────────────────────────────────────────────────
export interface FarmReportData {
  profile: {
    name: string;
    cropType: string;
    acreage?: number | null;
    soilType?: string | null;
    plantingDate?: Date | string | null;
    harvestDate?: Date | string | null;
    notes?: string | null;
  };
  locationName?: string | null;
  insights: {
    growingDegreeDaysForecast?: number | null;
    soilMoisture?: number | null;
    evapotranspiration7Day?: number | null;
    precipitationForecast?: number | null;
    precipitationDeficit?: number | null;
    nextFrostDate?: Date | string | null;
    frostRisk?: { level: string; description: string };
    heatStressRisk?: { level: string; description: string };
    droughtRisk?: { level: string; description: string };
    harvestDisruptionRisk?: { level: string; description: string };
    temperatureDaily?: { date: Date | string; tempMax: number; tempMin: number }[];
    precipitationDaily?: { date: Date | string; precipitation: number; precipitationProbability: number }[];
    windDaily?: { date: Date | string; windSpeedMax: number; windGustMax: number }[];
    uvDaily?: { date: Date | string; uvIndexMax: number }[];
    recommendations?: string[];
  };
}

export function generateFarmReportHtml(report: FarmReportData): string {
  const { profile, locationName, insights } = report;
  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── Season progress ──────────────────────────────────────────────────────
  let seasonHtml = "";
  const planting = profile.plantingDate ? new Date(profile.plantingDate as any) : null;
  const harvest  = profile.harvestDate  ? new Date(profile.harvestDate  as any) : null;
  const today    = new Date();

  if (planting || harvest) {
    let progressHtml = "";
    if (planting && harvest && !isNaN(planting.getTime()) && !isNaN(harvest.getTime())) {
      const total   = Math.max(1, Math.round((harvest.getTime() - planting.getTime()) / 86400000));
      const elapsed = Math.max(0, Math.min(total, Math.round((today.getTime() - planting.getTime()) / 86400000)));
      const pct     = Math.round((elapsed / total) * 100);
      const daysLeft = Math.max(0, total - elapsed);
      progressHtml = `
        <div style="margin-top:8px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:${MUTED};margin-bottom:4px;">
            <span>Day ${elapsed} of ${total}</span>
            <span>${daysLeft} days to harvest</span>
          </div>
          <div style="background:${BORDER};border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:${PRIMARY};height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </div>`;
    }

    seasonHtml = `
      ${sectionTitle("Season")}
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          ${planting ? `<td style="padding:6px 0;font-size:12px;color:${TEXT};width:50%;">
            <span style="color:${MUTED};font-size:10px;display:block;margin-bottom:2px;">Planting Date</span>
            ${fmt(planting)}
          </td>` : ""}
          ${harvest ? `<td style="padding:6px 0;font-size:12px;color:${TEXT};">
            <span style="color:${MUTED};font-size:10px;display:block;margin-bottom:2px;">Harvest Date</span>
            ${fmt(harvest)}
          </td>` : ""}
        </tr>
      </table>
      ${progressHtml}`;
  }

  // ── Current conditions ───────────────────────────────────────────────────
  const condItems = [
    { label: "GDD Forecast (15-day)", value: insights.growingDegreeDaysForecast != null ? `${insights.growingDegreeDaysForecast} °F-days` : "—" },
    { label: "Soil Moisture",         value: insights.soilMoisture               != null ? `${insights.soilMoisture.toFixed(1)}%` : "—" },
    { label: "7-Day ET",              value: insights.evapotranspiration7Day      != null ? `${insights.evapotranspiration7Day.toFixed(2)}"` : "—" },
    { label: "7-Day Precip Forecast", value: insights.precipitationForecast       != null ? `${insights.precipitationForecast.toFixed(2)}"` : "—" },
    { label: "Precip Deficit",        value: insights.precipitationDeficit        != null ? `${insights.precipitationDeficit.toFixed(2)}"` : "—" },
    { label: "Next Frost Date",       value: fmt(insights.nextFrostDate) },
  ];

  const condHtml = `
    ${sectionTitle("Current Conditions")}
    <table style="width:100%;border-collapse:collapse;">
      ${condItems.map(({ label, value }, i) => `
        <tr style="background:${i % 2 === 0 ? BG : CARD}">
          <td style="padding:6px 10px;font-size:11px;color:${MUTED};width:48%;">${label}</td>
          <td style="padding:6px 10px;font-size:12px;color:${TEXT};font-weight:600;">${value}</td>
        </tr>`).join("")}
    </table>`;

  // ── Risk assessment ──────────────────────────────────────────────────────
  const riskHtml = `
    ${sectionTitle("Risk Assessment")}
    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:${BG};">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">RISK</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">LEVEL</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">DETAIL</th>
        </tr>
      </thead>
      <tbody>
        ${riskRow("Frost Risk",             insights.frostRisk?.level,             insights.frostRisk?.description)}
        ${riskRow("Heat Stress",            insights.heatStressRisk?.level,        insights.heatStressRisk?.description)}
        ${riskRow("Drought",               insights.droughtRisk?.level,           insights.droughtRisk?.description)}
        ${riskRow("Harvest Disruption",    insights.harvestDisruptionRisk?.level, insights.harvestDisruptionRisk?.description)}
      </tbody>
    </table>`;

  // ── 7-day forecast table ─────────────────────────────────────────────────
  let forecastHtml = "";
  const hasTemp   = insights.temperatureDaily   && insights.temperatureDaily.length > 0;
  const hasPrecip = insights.precipitationDaily && insights.precipitationDaily.length > 0;
  const hasWind   = insights.windDaily          && insights.windDaily.length > 0;
  const hasUV     = insights.uvDaily            && insights.uvDaily.length > 0;

  if (hasTemp || hasPrecip || hasWind || hasUV) {
    const days = (insights.temperatureDaily ?? insights.precipitationDaily ?? insights.windDaily ?? insights.uvDaily)!;
    const headerCells = days.map((d) => {
      const lbl = dayLabel(d.date);
      const dtStr = fmtShort(d.date);
      return `<th style="padding:6px 4px;text-align:center;font-size:10px;color:${MUTED};font-weight:600;min-width:40px;">
        <div style="font-weight:700;color:${TEXT};">${lbl}</div>
        <div style="font-size:9px;">${dtStr}</div>
      </th>`;
    }).join("");

    const makeRow = (label: string, cells: string) => `
      <tr>
        <td style="padding:6px 8px;font-size:11px;color:${MUTED};white-space:nowrap;border-right:1px solid ${BORDER};">${label}</td>
        ${cells}
      </tr>`;

    const tempRow = hasTemp ? makeRow("High / Low °F",
      insights.temperatureDaily!.map((d) =>
        `<td style="padding:6px 4px;text-align:center;font-size:11px;">
          <span style="color:#EA580C;font-weight:600;">${Math.round(d.tempMax)}°</span>
          <span style="color:${MUTED};"> / </span>
          <span style="color:#3B82F6;font-weight:600;">${Math.round(d.tempMin)}°</span>
        </td>`).join("")
    ) : "";

    const uvRow = hasUV ? makeRow("UV Index",
      insights.uvDaily!.map((d) => {
        const c = uvColor(d.uvIndexMax);
        return `<td style="padding:6px 4px;text-align:center;">${badge(Math.round(d.uvIndexMax).toString(), c.bg, c.text)}</td>`;
      }).join("")
    ) : "";

    const windRow = hasWind ? makeRow("Wind (mph)",
      insights.windDaily!.map((d) => {
        const c = windColor(d.windSpeedMax);
        return `<td style="padding:6px 4px;text-align:center;font-size:11px;font-weight:600;color:${c.text};">
          ${Math.round(d.windSpeedMax)}
        </td>`;
      }).join("")
    ) : "";

    const precipRow = hasPrecip ? makeRow('Rain (in / %)',
      insights.precipitationDaily!.map((d) =>
        `<td style="padding:6px 4px;text-align:center;font-size:10px;">
          <div style="font-weight:600;color:#3B82F6;">${d.precipitation.toFixed(2)}"</div>
          <div style="color:${MUTED};">${d.precipitationProbability}%</div>
        </td>`).join("")
    ) : "";

    forecastHtml = `
      ${sectionTitle("7-Day Forecast")}
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};font-size:11px;">
          <thead>
            <tr style="background:${BG};">
              <th style="padding:6px 8px;text-align:left;font-size:10px;color:${MUTED};border-right:1px solid ${BORDER};"></th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${[tempRow, uvRow, windRow, precipRow].filter(Boolean).map((row, i) =>
              `<tr style="background:${i % 2 === 0 ? CARD : BG};">${row.replace(/^<tr>/, "").replace(/<\/tr>$/, "")}</tr>`
            ).join("")}
          </tbody>
        </table>
      </div>`;
  }

  // ── Recommendations ──────────────────────────────────────────────────────
  let recsHtml = "";
  if (insights.recommendations && insights.recommendations.length > 0) {
    recsHtml = `
      ${sectionTitle("Recommendations")}
      <ul style="margin:0;padding-left:18px;">
        ${insights.recommendations.map((r) =>
          `<li style="font-size:12px;color:${TEXT};margin-bottom:6px;line-height:1.5;">${r}</li>`
        ).join("")}
      </ul>`;
  }

  // ── Farm notes ───────────────────────────────────────────────────────────
  const notesHtml = profile.notes ? `
    ${sectionTitle("Farm Notes")}
    <p style="font-size:12px;color:${TEXT};line-height:1.6;margin:0;white-space:pre-wrap;">${profile.notes}</p>` : "";

  // ── Assemble ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Farm Report — ${profile.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: ${BG};
      color: ${TEXT};
      padding: 0;
    }
    @media print {
      body { background: white; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Header bar -->
  <div style="background:${PRIMARY};padding:24px 28px 20px;color:white;">
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;margin-bottom:6px;">
      Farm Report
    </div>
    <div style="font-size:26px;font-weight:700;line-height:1.2;margin-bottom:4px;">${profile.name}</div>
    <div style="font-size:13px;opacity:0.85;">${capitalize(profile.cropType)}${locationName ? ` · ${locationName}` : ""}</div>
    ${profile.acreage ? `<div style="font-size:12px;opacity:0.7;margin-top:2px;">${profile.acreage} acres${profile.soilType ? ` · ${capitalize(profile.soilType)} soil` : ""}</div>` : ""}
    <div style="font-size:11px;opacity:0.6;margin-top:10px;">Generated ${now}</div>
  </div>

  <!-- Body -->
  <div style="padding:16px 24px 32px;max-width:800px;margin:0 auto;">

    ${seasonHtml}
    ${condHtml}
    ${riskHtml}
    ${forecastHtml}
    ${recsHtml}
    ${notesHtml}

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid ${BORDER};
                font-size:10px;color:${MUTED};text-align:center;">
      Bloomy · Weather &amp; Agriculture Intelligence · ${now}
    </div>
  </div>

</body>
</html>`;
}
