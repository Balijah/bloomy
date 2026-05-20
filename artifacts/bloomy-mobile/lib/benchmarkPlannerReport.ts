import {
  BENCHMARK_DEMO_DISCLAIMER,
  type BenchmarkDataset,
  type BenchmarkScenarioResult,
  formatMoney,
  formatNumber,
} from "./benchmarkPlanner";

export interface BenchmarkPlannerReportData {
  farmName: string;
  locationName?: string | null;
  benchmark: BenchmarkDataset;
  result: BenchmarkScenarioResult;
  decisionLabel: string;
  generatedAt?: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function range(value: { low: number; median: number; high: number }, suffix = "") {
  return `${formatMoney(value.low)}-${formatMoney(value.high)}${suffix} · median ${formatMoney(value.median)}${suffix}`;
}

function row(label: string, value: string, peer: string, status: string) {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="num">${escapeHtml(value)}</td>
      <td>${escapeHtml(peer)}</td>
      <td><span class="pill">${escapeHtml(status)}</span></td>
    </tr>
  `;
}

export function generateBenchmarkPlannerHtml(data: BenchmarkPlannerReportData): string {
  const { farmName, locationName, benchmark, result, decisionLabel } = data;
  const generatedAt = data.generatedAt ?? new Date();
  const values = result.values;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Benchmark Planner Summary - ${escapeHtml(farmName)}</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      color: #232A23;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #FAF8F5;
    }
    .page {
      background: #fff;
      border: 1px solid #E8E0CE;
      border-radius: 16px;
      padding: 28px;
    }
    .eyebrow {
      color: #366441;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    h1 {
      margin: 6px 0 4px;
      font-size: 28px;
      line-height: 1.12;
    }
    .meta {
      color: #6E736E;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .disclaimer {
      border-left: 4px solid #CC9133;
      background: #FFF6E7;
      border-radius: 10px;
      padding: 12px 14px;
      color: #55442A;
      font-size: 12px;
      margin-bottom: 22px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .metric {
      border: 1px solid #E8E0CE;
      border-radius: 12px;
      padding: 14px;
      background: #FAF8F5;
    }
    .metric .label {
      color: #6E736E;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 7px;
    }
    .metric .value {
      font-size: 20px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }
    th {
      text-align: left;
      color: #6E736E;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .7px;
      padding: 9px 8px;
      border-bottom: 1px solid #E8E0CE;
    }
    td {
      padding: 11px 8px;
      border-bottom: 1px solid #F1EBE1;
      vertical-align: top;
    }
    .num {
      font-weight: 700;
    }
    .pill {
      display: inline-block;
      border-radius: 999px;
      background: #E8F1E9;
      color: #2F6841;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
    }
    .decision {
      margin-top: 22px;
      padding: 16px;
      border-radius: 12px;
      background: #E8F1E9;
      border: 1px solid #CFE3D2;
    }
    .decision strong {
      color: #23472D;
    }
    .footer {
      color: #6E736E;
      font-size: 11px;
      margin-top: 22px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="eyebrow">Benchmark Planner</div>
    <h1>${escapeHtml(farmName)}</h1>
    <div class="meta">
      ${escapeHtml(benchmark.cropLabel)} · ${escapeHtml(benchmark.regionLabel)}
      ${locationName ? ` · ${escapeHtml(locationName)}` : ""}
      · Generated ${escapeHtml(generatedAt.toLocaleDateString())}
    </div>

    <div class="disclaimer">${escapeHtml(BENCHMARK_DEMO_DISCLAIMER)}</div>

    <div class="grid">
      <div class="metric">
        <div class="label">Input Cost</div>
        <div class="value">${formatMoney(result.totalInputCost)}/acre</div>
      </div>
      <div class="metric">
        <div class="label">Revenue</div>
        <div class="value">${formatMoney(result.revenuePerAcre)}/acre</div>
      </div>
      <div class="metric">
        <div class="label">Margin</div>
        <div class="value">${formatMoney(result.marginPerAcre)}/acre</div>
      </div>
      <div class="metric">
        <div class="label">Peer Median</div>
        <div class="value">${formatMoney(benchmark.metrics.margin.median)}/acre</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Scenario</th>
          <th>Peer benchmark</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${row("Seed", `${formatMoney(values.seed)}/acre`, range(benchmark.metrics.seed, "/acre"), result.comparisons.seed.label)}
        ${row("Fertilizer", `${formatMoney(values.fertilizer)}/acre`, range(benchmark.metrics.fertilizer, "/acre"), result.comparisons.fertilizer.label)}
        ${row("Chemicals", `${formatMoney(values.chemicals)}/acre`, range(benchmark.metrics.chemicals, "/acre"), result.comparisons.chemicals.label)}
        ${row("Total input cost", `${formatMoney(result.totalInputCost)}/acre`, range(benchmark.metrics.totalInputCost, "/acre"), result.comparisons.totalInputCost.label)}
        ${row("Expected yield", `${formatNumber(values.yieldPerAcre)} ${benchmark.yieldUnit}`, `${formatNumber(benchmark.metrics.expectedYield.low)}-${formatNumber(benchmark.metrics.expectedYield.high)} ${benchmark.yieldUnit} · median ${formatNumber(benchmark.metrics.expectedYield.median)}`, result.summary.label)}
        ${row("Projected margin", `${formatMoney(result.marginPerAcre)}/acre`, range(benchmark.metrics.margin, "/acre"), result.comparisons.margin.label)}
      </tbody>
    </table>

    <div class="decision">
      <strong>Decision:</strong> ${escapeHtml(decisionLabel)}<br />
      Margin gap versus peer median: ${formatMoney(result.marginGapPerAcre, 0)}/acre.
      ${result.totalFarmMargin != null ? `Projected total farm margin: ${formatMoney(result.totalFarmMargin)}.` : ""}
    </div>

    <div class="footer">
      This summary is decision-support context for reviewing input quotes before signing purchase agreements.
    </div>
  </div>
</body>
</html>`;
}
