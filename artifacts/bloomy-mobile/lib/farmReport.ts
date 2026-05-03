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

// ── USDA ERS national-average cost hints (corn, $/acre) ──────────────────────
const ERS_HINTS: Record<string, number> = {
  seed: 120, fertilizer: 180, herbicide: 60, pesticide: 25,
  fuel: 35, labor: 30, custom_operation: 50, equipment: 150,
  irrigation: 0, drying: 35, other: 0,
};

// ── Default market price hints ($/unit) ──────────────────────────────────────
const PRICE_HINTS: Record<string, { price: number; unit: string }> = {
  corn:         { price: 4.50, unit: "bu" },
  soybeans:     { price: 12.00, unit: "bu" },
  winter_wheat: { price: 5.50, unit: "bu" },
  cotton:       { price: 0.80, unit: "lb" },
  rice:         { price: 14.00, unit: "cwt" },
  potatoes:     { price: 10.00, unit: "cwt" },
  grapes:       { price: 800.00, unit: "ton" },
  almonds:      { price: 1.80, unit: "lb" },
  apples:       { price: 25.00, unit: "bu" },
  other:        { price: 0, unit: "unit" },
};

// ── USDA APH average yields ───────────────────────────────────────────────────
const APH_AVG: Record<string, number> = {
  corn: 175, soybeans: 50, winter_wheat: 52, cotton: 900,
  potatoes: 430, grapes: 5, almonds: 2000, apples: 22, rice: 130,
};

// ── Input cost line-item type ─────────────────────────────────────────────────
export interface InputCostItem {
  id: number;
  category: string;
  item: string;
  costPerAcre: number | null;
  totalCost: number | null;
  acresApplied: number | null;
  notes: string | null;
}

// ── Yield record type ─────────────────────────────────────────────────────────
export interface YieldRecordItem {
  id: number;
  harvestYear: number;
  actualYield: number;
  notes: string | null;
}

// ── Cost helpers (no React) ───────────────────────────────────────────────────
function effectiveCpa(item: InputCostItem, farmAcreage: number | null | undefined): number | null {
  if (item.costPerAcre != null) return item.costPerAcre;
  if (item.totalCost != null) {
    const acres = item.acresApplied ?? farmAcreage;
    if (acres && acres > 0) return item.totalCost / acres;
  }
  return null;
}

function trackedTotal(items: InputCostItem[], farmAcreage: number | null | undefined): number {
  return items.reduce((s, it) => s + (effectiveCpa(it, farmAcreage) ?? 0), 0);
}

// ── Category label map ────────────────────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  seed: "Seed", fertilizer: "Fertilizer", herbicide: "Herbicide",
  pesticide: "Pesticide", fuel: "Fuel", labor: "Labor",
  custom_operation: "Custom Operation", equipment: "Equipment",
  irrigation: "Irrigation", drying: "Drying", other: "Other",
};
const CAT_COLOR: Record<string, string> = {
  seed: "#4D8A5E", fertilizer: "#366441", herbicide: "#8B7355",
  pesticide: "#7B5EA7", fuel: "#C15A3A", labor: "#2D7DD2",
  custom_operation: "#E8A020", equipment: "#5B5B5B",
  irrigation: "#0EA5E9", drying: "#DC6803", other: "#6B7280",
};

// ── Section: Input Costs ──────────────────────────────────────────────────────
function buildInputCostsSection(
  items: InputCostItem[],
  estimateCpa: number | null | undefined,
  farmAcreage: number | null | undefined
): string {
  if (!items.length) return "";

  const tracked = trackedTotal(items, farmAcreage);
  const totalFarm = farmAcreage ? Math.round(tracked * farmAcreage) : null;
  const diff = estimateCpa != null ? tracked - estimateCpa : null;
  const diffPct = diff != null && estimateCpa! > 0 ? Math.round((diff / estimateCpa!) * 100) : null;
  const significant = Math.abs(diffPct ?? 0) > 5;

  let statusBg = "#DCFCE7"; let statusText = "#16A34A"; let statusLabel = "On Budget";
  if (diff != null && significant) {
    if (diff > 0) { statusBg = "#FEE2E2"; statusText = "#DC2626"; statusLabel = "Over Estimate"; }
    else          { statusBg = "#FEF9C3"; statusText = "#CA8A04"; statusLabel = "Under Estimate"; }
  }

  // Summary strip
  const summaryHtml = `
    <div style="display:flex;gap:0;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;margin-bottom:10px;">
      <div style="flex:1;padding:12px 14px;background:#366441;color:white;text-align:center;">
        <div style="font-size:20px;font-weight:700;line-height:1.2;">$${tracked%1===0?tracked:tracked.toFixed(2)}</div>
        <div style="font-size:9px;opacity:.75;margin-top:2px;text-transform:uppercase;letter-spacing:.5px;">Tracked /acre</div>
      </div>
      ${estimateCpa != null ? `
      <div style="flex:1;padding:12px 14px;background:${BG};text-align:center;">
        <div style="font-size:20px;font-weight:700;line-height:1.2;color:${TEXT};">$${estimateCpa%1===0?estimateCpa:estimateCpa.toFixed(2)}</div>
        <div style="font-size:9px;color:${MUTED};margin-top:2px;text-transform:uppercase;letter-spacing:.5px;">B/E Estimate</div>
      </div>` : ""}
      ${totalFarm != null ? `
      <div style="flex:1;padding:12px 14px;background:${BG};text-align:center;">
        <div style="font-size:20px;font-weight:700;line-height:1.2;color:${TEXT};">$${totalFarm.toLocaleString()}</div>
        <div style="font-size:9px;color:${MUTED};margin-top:2px;text-transform:uppercase;letter-spacing:.5px;">Total Farm</div>
      </div>` : ""}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      ${badge(statusLabel + (diffPct!=null&&significant?(diff!>0?` (+${diffPct}%)`:`(${diffPct}%)`):""), statusBg, statusText)}
      <span style="font-size:11px;color:${MUTED};">${items.length} line item${items.length!==1?"s":""}</span>
    </div>`;

  // Category breakdown with inline bar chart
  const grouped: Record<string, InputCostItem[]> = {};
  for (const it of items) {
    (grouped[it.category] = grouped[it.category] ?? []).push(it);
  }
  const cats = Object.keys(grouped).sort((a, b) => {
    const sa = grouped[a].reduce((s, it) => s+(effectiveCpa(it,farmAcreage)??0), 0);
    const sb = grouped[b].reduce((s, it) => s+(effectiveCpa(it,farmAcreage)??0), 0);
    return sb - sa;
  });

  const catRows = cats.map((cat) => {
    const its = grouped[cat];
    const sub = its.reduce((s, it) => s+(effectiveCpa(it,farmAcreage)??0), 0);
    const pct = tracked > 0 ? Math.round((sub/tracked)*100) : 0;
    const col = CAT_COLOR[cat] ?? "#6B7280";
    const lbl = CAT_LABEL[cat] ?? capitalize(cat);
    return `
      <tr>
        <td style="padding:8px 10px;font-size:12px;color:${TEXT};font-weight:600;white-space:nowrap;width:120px;">${lbl}</td>
        <td style="padding:8px 10px;">
          <div style="background:${BORDER};border-radius:3px;height:8px;overflow:hidden;min-width:80px;">
            <div style="background:${col};height:100%;width:${pct}%;border-radius:3px;"></div>
          </div>
        </td>
        <td style="padding:8px 10px;font-size:11px;color:${MUTED};text-align:right;width:30px;">${pct}%</td>
        <td style="padding:8px 10px;font-size:12px;color:${col};font-weight:700;text-align:right;white-space:nowrap;">$${sub%1===0?sub:sub.toFixed(2)}/ac</td>
      </tr>
      ${its.map(it => {
        const cpa = effectiveCpa(it, farmAcreage);
        return `<tr style="background:${BG};">
          <td style="padding:4px 10px 4px 22px;font-size:11px;color:${MUTED};" colspan="2">${it.item}${it.notes?` · ${it.notes}`:""}</td>
          <td style="padding:4px 10px;font-size:11px;color:${MUTED};text-align:right;"></td>
          <td style="padding:4px 10px;font-size:11px;color:${TEXT};text-align:right;white-space:nowrap;">
            ${cpa!=null?`$${cpa%1===0?cpa:cpa.toFixed(2)}/ac`:it.totalCost!=null?`$${it.totalCost.toLocaleString()} total`:"—"}
          </td>
        </tr>`;
      }).join("")}`;
  }).join("");

  return `
    ${sectionTitle("Input Cost Analysis")}
    ${summaryHtml}
    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:${BG};">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">CATEGORY</th>
          <th style="padding:7px 10px;font-size:10px;color:${MUTED};font-weight:600;"></th>
          <th style="padding:7px 10px;font-size:10px;color:${MUTED};font-weight:600;text-align:right;letter-spacing:.5px;">SHARE</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">$/ACRE</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>`;
}

// ── Section: Breakeven Analysis ───────────────────────────────────────────────
function buildBreakevenSection(
  costPerAcre: number | null | undefined,
  yieldGoal: number | null | undefined,
  cropType: string,
  trackedCpa: number | null,
): string {
  const hasCost = costPerAcre != null && costPerAcre > 0;
  const hasGoal = yieldGoal   != null && yieldGoal   > 0;
  if (!hasCost && !hasGoal) return "";

  const priceHint = PRICE_HINTS[cropType] ?? PRICE_HINTS.other;
  const breakevenYield = hasCost && priceHint.price > 0
    ? (costPerAcre! / priceHint.price)
    : null;

  const margin = breakevenYield != null && hasGoal
    ? ((yieldGoal! - breakevenYield) / yieldGoal!) * 100
    : null;

  const metrics = [
    hasCost     ? { label: "Cost Estimate",     value: `$${costPerAcre!.toFixed(2)}/acre`  } : null,
    trackedCpa != null && trackedCpa > 0
                ? { label: "Tracked Cost",       value: `$${trackedCpa.toFixed(2)}/acre`   } : null,
    hasGoal     ? { label: "Yield Goal",         value: `${yieldGoal} ${priceHint.unit}/ac` } : null,
    breakevenYield != null
                ? { label: "Breakeven Yield",    value: `${breakevenYield.toFixed(1)} ${priceHint.unit}/ac` } : null,
    margin != null
                ? { label: "Safety Margin",      value: `${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%` } : null,
    priceHint.price > 0
                ? { label: "Reference Price",    value: `$${priceHint.price.toFixed(2)}/${priceHint.unit}` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  // Scenario table (Low/Target/High)
  let scenariosHtml = "";
  if (hasCost && priceHint.price > 0) {
    const scenarios = [
      { label: "Low",    yield: hasGoal ? yieldGoal! * 0.80 : null },
      { label: "Target", yield: hasGoal ? yieldGoal! * 1.00 : null },
      { label: "High",   yield: hasGoal ? yieldGoal! * 1.20 : null },
    ].filter(s => s.yield != null) as { label: string; yield: number }[];

    if (scenarios.length) {
      const rows = scenarios.map(({ label, yield: y }) => {
        const rev   = y * priceHint.price;
        const profit = rev - costPerAcre!;
        const color  = profit >= 0 ? "#16A34A" : "#DC2626";
        return `<tr>
          <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};">${label}</td>
          <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};">${y.toFixed(1)} ${priceHint.unit}/ac</td>
          <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};">$${rev.toFixed(2)}/ac</td>
          <td style="padding:7px 10px;font-size:12px;font-weight:700;color:${color};border-bottom:1px solid ${BORDER};">${profit>=0?"+":""}$${profit.toFixed(2)}/ac</td>
        </tr>`;
      }).join("");
      scenariosHtml = `
        <div style="margin-top:12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${MUTED};margin-bottom:6px;">Profit Scenarios</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:${BG};">
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">SCENARIO</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">YIELD</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">REVENUE/AC</th>
                <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">PROFIT/AC</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }
  }

  const metricsHtml = `
    <table style="width:100%;border-collapse:collapse;">
      ${metrics.map(({ label, value }, i) => `
        <tr style="background:${i%2===0?BG:CARD}">
          <td style="padding:6px 10px;font-size:11px;color:${MUTED};width:48%;">${label}</td>
          <td style="padding:6px 10px;font-size:12px;color:${TEXT};font-weight:600;">${value}</td>
        </tr>`).join("")}
    </table>`;

  return `${sectionTitle("Breakeven Analysis")}${metricsHtml}${scenariosHtml}`;
}

// ── Section: Yield History ────────────────────────────────────────────────────
function buildYieldHistorySection(
  records: YieldRecordItem[],
  cropType: string,
): string {
  if (!records.length) return "";

  const sorted = [...records].sort((a, b) => a.harvestYear - b.harvestYear);
  const aphAvg = APH_AVG[cropType] ?? null;
  const priceHint = PRICE_HINTS[cropType] ?? PRICE_HINTS.other;

  // Compute APH (5-year trailing avg of most recent records)
  const recentYields = sorted.slice(-5).map(r => r.actualYield);
  const aph = recentYields.length
    ? recentYields.reduce((s, v) => s+v, 0) / recentYields.length
    : null;

  const rows = sorted.map((r, i) => {
    const prev  = i > 0 ? sorted[i-1].actualYield : null;
    const chg   = prev != null ? r.actualYield - prev : null;
    const vsAvg = aphAvg != null ? r.actualYield - aphAvg : null;
    const chgColor  = chg  == null ? MUTED : chg  >= 0 ? "#16A34A" : "#DC2626";
    const avgColor  = vsAvg == null ? MUTED : vsAvg >= 0 ? "#16A34A" : "#DC2626";
    return `<tr style="background:${i%2===0?CARD:BG};">
      <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};font-weight:600;">${r.harvestYear}</td>
      <td style="padding:7px 10px;font-size:12px;color:${TEXT};border-bottom:1px solid ${BORDER};">${r.actualYield} ${priceHint.unit}/ac</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:${chgColor};border-bottom:1px solid ${BORDER};">
        ${chg == null ? "—" : `${chg>=0?"+":""}${chg.toFixed(1)}`}
      </td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:${avgColor};border-bottom:1px solid ${BORDER};">
        ${vsAvg == null ? "—" : `${vsAvg>=0?"+":""}${vsAvg.toFixed(1)}`}
      </td>
      <td style="padding:7px 10px;font-size:11px;color:${MUTED};border-bottom:1px solid ${BORDER};">${r.notes ?? ""}</td>
    </tr>`;
  }).join("");

  const aphRow = aph != null ? `
    <tr style="background:#366441;color:white;">
      <td style="padding:7px 10px;font-size:11px;font-weight:700;" colspan="2">
        ${recentYields.length}-yr APH: ${aph.toFixed(1)} ${priceHint.unit}/ac
      </td>
      <td colspan="3" style="padding:7px 10px;font-size:11px;opacity:.8;">
        ${aphAvg != null ? `USDA national avg: ${aphAvg} ${priceHint.unit}/ac` : ""}
      </td>
    </tr>` : "";

  return `
    ${sectionTitle("Yield History")}
    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:${BG};">
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">YEAR</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">YIELD</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">YR CHANGE</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">VS USDA AVG</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;color:${MUTED};font-weight:600;letter-spacing:.5px;">NOTES</th>
        </tr>
      </thead>
      <tbody>${rows}${aphRow}</tbody>
    </table>`;
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
    costPerAcre?: number | null;
    yieldGoal?: number | null;
  };
  locationName?: string | null;
  inputCosts?: InputCostItem[];
  yieldRecords?: YieldRecordItem[];
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
  const { profile, locationName, insights, inputCosts = [], yieldRecords = [] } = report;
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

  // ── New sections ─────────────────────────────────────────────────────────
  const trackedCpa = inputCosts.length > 0 ? trackedTotal(inputCosts, profile.acreage) : null;
  const inputCostsHtml  = buildInputCostsSection(inputCosts, profile.costPerAcre, profile.acreage);
  const breakevenHtml   = buildBreakevenSection(profile.costPerAcre, profile.yieldGoal, profile.cropType, trackedCpa);
  const yieldHistoryHtml = buildYieldHistorySection(yieldRecords, profile.cropType);

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
    ${inputCostsHtml}
    ${breakevenHtml}
    ${yieldHistoryHtml}
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
