/**
 * Scouting report HTML generator.
 * Produces a PDF-ready document of critical and high-severity field notes
 * formatted for hand-off to a spray crew or agronomist.
 */

import type { FieldNote } from "@workspace/api-client-react";

// ── Brand palette ─────────────────────────────────────────────────────────────
const PRIMARY  = "#366441";
const PRIMARY2 = "#4D8A5E";
const BG       = "#FAF8F5";
const CARD     = "#FFFFFF";
const BORDER   = "#E8E0CE";
const MUTED    = "#6E736E";
const TEXT     = "#232A23";

// ── Category metadata ─────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; bg: string; color: string }> = {
  pest:       { label: "Pest",       bg: "#FEE2E2", color: "#B94040" },
  disease:    { label: "Disease",    bg: "#F3E8FF", color: "#A0509A" },
  soil:       { label: "Soil",       bg: "#F5EFE6", color: "#8B5E3C" },
  weather:    { label: "Weather",    bg: "#EFF6FF", color: "#2860A8" },
  irrigation: { label: "Irrigation", bg: "#E0F2FE", color: "#0E7490" },
  general:    { label: "General",    bg: "#F1F5F9", color: "#5A6A72" },
};

// ── Severity metadata ─────────────────────────────────────────────────────────
const SEV_META: Record<string, { label: string; bg: string; color: string; rank: number }> = {
  critical: { label: "CRITICAL", bg: "#FEE2E2", color: "#9B1C1C", rank: 0 },
  high:     { label: "HIGH",     bg: "#FFEDD5", color: "#C25214", rank: 1 },
  medium:   { label: "MEDIUM",   bg: "#FEF9C3", color: "#B97B14", rank: 2 },
  low:      { label: "LOW",      bg: "#DCFCE7", color: "#1A7340", rank: 3 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(raw: string): string {
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function badge(text: string, bg: string, color: string, bold = true) {
  return `<span style="
    display:inline-block;
    padding:2px 8px;
    border-radius:999px;
    background:${bg};
    color:${color};
    font-size:10px;
    font-weight:${bold ? 700 : 500};
    letter-spacing:.4px;
  ">${text}</span>`;
}

// ── Exported severities ───────────────────────────────────────────────────────
export const EXPORT_SEVERITIES = ["critical", "high"] as const;

export function filterExportNotes(notes: FieldNote[]): FieldNote[] {
  return notes
    .filter((n) => n.severity && (EXPORT_SEVERITIES as readonly string[]).includes(n.severity))
    .sort((a, b) => {
      const rankA = SEV_META[a.severity ?? "low"]?.rank ?? 99;
      const rankB = SEV_META[b.severity ?? "low"]?.rank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      // Within same severity, newest first
      return (b.date as string).localeCompare(a.date as string);
    });
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface ScoutingReportOptions {
  farmName: string;
  notes: FieldNote[];
}

export function generateScoutingReportHtml(opts: ScoutingReportOptions): string {
  const { farmName, notes } = opts;
  const exportNotes = filterExportNotes(notes);

  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const criticalCount = exportNotes.filter((n) => n.severity === "critical").length;
  const highCount     = exportNotes.filter((n) => n.severity === "high").length;

  // ── Summary banner ──────────────────────────────────────────────────────
  const summaryColor = criticalCount > 0 ? "#9B1C1C" : "#C25214";
  const summaryBg    = criticalCount > 0 ? "#FEE2E2" : "#FFEDD5";

  const summaryHtml = `
    <div style="
      background:${summaryBg};
      border:1px solid ${summaryColor}30;
      border-radius:10px;
      padding:14px 18px;
      margin-bottom:20px;
      display:flex;
      align-items:center;
      gap:14px;
    ">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:${summaryColor};margin-bottom:4px;">
          ${exportNotes.length} note${exportNotes.length !== 1 ? "s" : ""} requiring attention
        </div>
        <div style="font-size:11px;color:${MUTED};">
          ${criticalCount > 0 ? `<span style="color:#9B1C1C;font-weight:600;">${criticalCount} critical</span>` : ""}
          ${criticalCount > 0 && highCount > 0 ? " &nbsp;·&nbsp; " : ""}
          ${highCount > 0 ? `<span style="color:#C25214;font-weight:600;">${highCount} high</span>` : ""}
        </div>
      </div>
      <div style="text-align:right;font-size:11px;color:${MUTED};">
        Review all items<br/>before application
      </div>
    </div>`;

  // ── Empty state ─────────────────────────────────────────────────────────
  if (exportNotes.length === 0) {
    return buildHtml(farmName, now, `
      <div style="text-align:center;padding:48px 24px;color:${MUTED};font-size:13px;">
        No critical or high severity scouting notes found for this farm.
      </div>
    `);
  }

  // ── Note cards ──────────────────────────────────────────────────────────
  const noteCardsHtml = exportNotes.map((note, idx) => {
    const cat = CAT_META[note.category] ?? CAT_META.general;
    const sev = SEV_META[note.severity ?? "low"] ?? SEV_META.low;
    const dateStr = typeof note.date === "string" ? note.date : String(note.date).slice(0, 10);
    const photoNote = note.photoData && note.photoData.length > 0
      ? `<div style="font-size:11px;color:${MUTED};margin-top:8px;font-style:italic;">
           📷 ${note.photoData.length} photo${note.photoData.length !== 1 ? "s" : ""} attached — open in Bloomy app to view
         </div>`
      : "";

    return `
      <div style="
        background:${CARD};
        border:1px solid ${BORDER};
        border-left:4px solid ${sev.color};
        border-radius:8px;
        padding:14px 16px;
        margin-bottom:14px;
        page-break-inside:avoid;
      ">
        <!-- Row 1: index + badges + date -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="
            font-size:11px;font-weight:700;color:${MUTED};
            min-width:20px;
          ">#${idx + 1}</span>
          ${badge(sev.label, sev.bg, sev.color)}
          ${badge(cat.label, cat.bg, cat.color, false)}
          <span style="margin-left:auto;font-size:11px;color:${MUTED};">${fmtDate(dateStr)}</span>
        </div>

        <!-- Title -->
        <div style="font-size:14px;font-weight:700;color:${TEXT};margin-bottom:6px;line-height:1.3;">
          ${note.title}
        </div>

        <!-- Body -->
        <div style="font-size:12px;color:${TEXT};line-height:1.65;white-space:pre-wrap;">${note.body}</div>

        ${photoNote}

        <!-- Action checkbox -->
        <div style="
          margin-top:12px;
          padding-top:10px;
          border-top:1px dashed ${BORDER};
          display:flex;
          align-items:center;
          gap:10px;
        ">
          <div style="
            width:16px;height:16px;
            border:2px solid ${sev.color};
            border-radius:4px;
            flex-shrink:0;
          "></div>
          <span style="font-size:11px;color:${MUTED};">Action taken / resolved</span>
          <div style="flex:1;border-bottom:1px dotted ${BORDER};margin:0 12px;"></div>
          <span style="font-size:11px;color:${MUTED};">Date: ___________</span>
        </div>
      </div>`;
  }).join("");

  // ── Sign-off block ──────────────────────────────────────────────────────
  const signOffHtml = `
    <div style="
      margin-top:24px;
      padding:16px 18px;
      border:1px solid ${BORDER};
      border-radius:8px;
      background:${BG};
    ">
      <div style="font-size:11px;font-weight:700;color:${MUTED};letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px;">
        Sign-off
      </div>
      <div style="display:flex;gap:32px;">
        <div style="flex:1;">
          <div style="font-size:11px;color:${MUTED};margin-bottom:20px;">Reviewed by (print)</div>
          <div style="border-bottom:1px solid ${MUTED};"></div>
        </div>
        <div style="flex:1;">
          <div style="font-size:11px;color:${MUTED};margin-bottom:20px;">Signature &amp; date</div>
          <div style="border-bottom:1px solid ${MUTED};"></div>
        </div>
      </div>
    </div>`;

  const body = summaryHtml + noteCardsHtml + signOffHtml;
  return buildHtml(farmName, now, body);
}

// ── HTML shell ────────────────────────────────────────────────────────────────
function buildHtml(farmName: string, now: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Scouting Report — ${farmName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: ${BG};
      color: ${TEXT};
    }
    @media print {
      body { background: white; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="background:${PRIMARY};padding:22px 28px 18px;color:white;">
    <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.7;margin-bottom:5px;">
      Scouting Report · Critical &amp; High Priority
    </div>
    <div style="font-size:24px;font-weight:700;line-height:1.2;margin-bottom:3px;">${farmName}</div>
    <div style="font-size:12px;opacity:0.75;">For spray crew / agronomist review</div>
    <div style="
      margin-top:10px;
      padding-top:10px;
      border-top:1px solid rgba(255,255,255,0.25);
      font-size:11px;opacity:0.6;
    ">Generated ${now} · Bloomy Agriculture Intelligence</div>
  </div>

  <!-- Disclaimer bar -->
  <div style="background:${PRIMARY2};padding:8px 28px;font-size:11px;color:rgba(255,255,255,0.9);">
    ⚠ Always read and follow product label directions. Verify field conditions before application.
  </div>

  <!-- Body -->
  <div style="padding:20px 24px 36px;max-width:800px;margin:0 auto;">
    ${body}

    <!-- Footer -->
    <div style="
      margin-top:36px;
      padding-top:12px;
      border-top:1px solid ${BORDER};
      font-size:10px;
      color:${MUTED};
      text-align:center;
      line-height:1.6;
    ">
      Bloomy · Weather &amp; Agriculture Intelligence<br/>
      This report reflects notes recorded as of ${now}. Open the Bloomy app for the latest data.
    </div>
  </div>

</body>
</html>`;
}
