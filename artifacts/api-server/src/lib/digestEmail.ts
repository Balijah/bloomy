/**
 * Weekly digest email sender.
 * Uses SendGrid to deliver a branded HTML summary to opted-in users.
 * Requires SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables.
 */

import sgMail from "@sendgrid/mail";
import { logger } from "./logger";

const SENDGRID_API_KEY = process.env["SENDGRID_API_KEY"] ?? "";
const FROM_EMAIL = process.env["SENDGRID_FROM_EMAIL"] ?? "";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FarmDigestRow {
  name: string;
  cropType: string | null;
  alertCount: number;
  noteCount: number;
}

export interface DigestEmailData {
  toEmail: string;
  toName?: string | null;
  farms: FarmDigestRow[];
  totalAlerts: number;
  totalNotes: number;
  digestDate: string;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

const COLOR_PRIMARY = "#366441";
const COLOR_BG = "#FAF8F5";
const COLOR_CARD = "#FFFFFF";
const COLOR_BORDER = "#E8E4DF";
const COLOR_MUTED = "#7A8A7A";
const COLOR_AMBER = "#CC9133";
const COLOR_DANGER = "#B84A4A";

function severityBadge(alertCount: number, noteCount: number): string {
  if (alertCount === 0 && noteCount === 0) {
    return `<span style="display:inline-block;background:#E8F5EC;color:${COLOR_PRIMARY};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;">All Clear</span>`;
  }
  const parts: string[] = [];
  if (alertCount > 0) {
    parts.push(`${alertCount} alert${alertCount !== 1 ? "s" : ""}`);
  }
  if (noteCount > 0) {
    parts.push(`${noteCount} issue${noteCount !== 1 ? "s" : ""}`);
  }
  const color = alertCount > 0 ? COLOR_DANGER : COLOR_AMBER;
  const bg = alertCount > 0 ? "#FFF0F0" : "#FFF8EC";
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;">${parts.join(" · ")}</span>`;
}

function cropLabel(cropType: string | null): string {
  const labels: Record<string, string> = {
    corn: "Corn",
    soybeans: "Soybeans",
    winter_wheat: "Winter Wheat",
    cotton: "Cotton",
    almonds: "Almonds",
    grapes: "Grapes",
    apples: "Apples",
    potatoes: "Potatoes",
    rice: "Rice",
    other: "Other",
  };
  return cropType ? (labels[cropType] ?? cropType) : "General";
}

function buildFarmRow(farm: FarmDigestRow): string {
  return `
    <tr>
      <td style="padding:14px 20px;border-bottom:1px solid ${COLOR_BORDER};vertical-align:middle;">
        <div style="font-size:15px;font-weight:600;color:#1A241A;">${farm.name}</div>
        <div style="font-size:12px;color:${COLOR_MUTED};margin-top:2px;">${cropLabel(farm.cropType)}</div>
      </td>
      <td style="padding:14px 20px;border-bottom:1px solid ${COLOR_BORDER};text-align:right;vertical-align:middle;white-space:nowrap;">
        ${severityBadge(farm.alertCount, farm.noteCount)}
      </td>
    </tr>`;
}

function buildHtml(data: DigestEmailData): string {
  const { toName, farms, totalAlerts, totalNotes, digestDate } = data;
  const greeting = toName ? `Hi ${toName},` : "Hello,";
  const allClear = totalAlerts === 0 && totalNotes === 0;

  const summaryBar = allClear
    ? `<div style="background:#E8F5EC;border-radius:8px;padding:14px 20px;margin:0 0 24px;text-align:center;">
        <span style="font-size:16px;color:${COLOR_PRIMARY};font-weight:600;">All farms clear this week</span>
        <div style="font-size:13px;color:${COLOR_MUTED};margin-top:4px;">No critical alerts or scouting issues across your ${farms.length} farm${farms.length !== 1 ? "s" : ""}.</div>
      </div>`
    : `<div style="background:#FFF8EC;border-radius:8px;padding:14px 20px;margin:0 0 24px;display:flex;gap:24px;text-align:center;">
        <div style="flex:1;">
          <div style="font-size:24px;font-weight:700;color:${COLOR_DANGER};">${totalAlerts}</div>
          <div style="font-size:12px;color:${COLOR_MUTED};">Weather Alert${totalAlerts !== 1 ? "s" : ""}</div>
        </div>
        <div style="width:1px;background:${COLOR_BORDER};"></div>
        <div style="flex:1;">
          <div style="font-size:24px;font-weight:700;color:${COLOR_AMBER};">${totalNotes}</div>
          <div style="font-size:12px;color:${COLOR_MUTED};">Scouting Issue${totalNotes !== 1 ? "s" : ""}</div>
        </div>
        <div style="width:1px;background:${COLOR_BORDER};"></div>
        <div style="flex:1;">
          <div style="font-size:24px;font-weight:700;color:${COLOR_PRIMARY};">${farms.length}</div>
          <div style="font-size:12px;color:${COLOR_MUTED};">Farm${farms.length !== 1 ? "s" : ""}</div>
        </div>
      </div>`;

  const farmRows = farms.map(buildFarmRow).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bloomy Weekly Farm Digest</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background-color:${COLOR_PRIMARY};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Bloomy</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.75);margin-top:6px;font-weight:500;">Weekly Farm Digest · ${digestDate}</div>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:${COLOR_CARD};padding:32px;border-left:1px solid ${COLOR_BORDER};border-right:1px solid ${COLOR_BORDER};">
              <p style="margin:0 0 20px;font-size:16px;color:#1A241A;">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#3A4A3A;line-height:1.6;">
                Here's your weekly summary of farm conditions, weather alerts, and scouting notes.
              </p>

              ${summaryBar}

              <!-- Farm breakdown table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR_BORDER};border-radius:8px;overflow:hidden;margin-bottom:28px;">
                <thead>
                  <tr>
                    <th style="padding:10px 20px;background:#F4F0EB;text-align:left;font-size:11px;font-weight:600;color:${COLOR_MUTED};text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${COLOR_BORDER};">Farm</th>
                    <th style="padding:10px 20px;background:#F4F0EB;text-align:right;font-size:11px;font-weight:600;color:${COLOR_MUTED};text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${COLOR_BORDER};">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${farmRows}
                </tbody>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="#"
                       style="display:inline-block;background-color:${COLOR_PRIMARY};color:#FFFFFF;font-size:16px;font-weight:600;padding:14px 36px;border-radius:999px;text-decoration:none;letter-spacing:0.2px;">
                      Open Bloomy
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F0EDE8;border-radius:0 0 12px 12px;border:1px solid ${COLOR_BORDER};border-top:none;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLOR_MUTED};line-height:1.6;">
                You're receiving this because you enabled the Weekly Digest in Bloomy.<br/>
                To stop these emails, open <strong>Settings → Notifications → Weekly Farm Digest</strong> in the app.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(data: DigestEmailData): string {
  const { toName, farms, totalAlerts, totalNotes, digestDate } = data;
  const greeting = toName ? `Hi ${toName},` : "Hello,";
  const lines = [
    `BLOOMY — Weekly Farm Digest (${digestDate})`,
    "=".repeat(50),
    "",
    greeting,
    "",
    `Summary: ${farms.length} farm${farms.length !== 1 ? "s" : ""} · ${totalAlerts} alert${totalAlerts !== 1 ? "s" : ""} · ${totalNotes} scouting issue${totalNotes !== 1 ? "s" : ""}`,
    "",
    "FARM BREAKDOWN",
    "-".repeat(30),
  ];
  for (const farm of farms) {
    const status =
      farm.alertCount === 0 && farm.noteCount === 0
        ? "All clear"
        : [
            farm.alertCount > 0 ? `${farm.alertCount} alert${farm.alertCount !== 1 ? "s" : ""}` : null,
            farm.noteCount > 0 ? `${farm.noteCount} issue${farm.noteCount !== 1 ? "s" : ""}` : null,
          ]
            .filter(Boolean)
            .join(", ");
    lines.push(`• ${farm.name} (${cropLabel(farm.cropType)}): ${status}`);
  }
  lines.push(
    "",
    "Open Bloomy to review your farms.",
    "",
    "---",
    "You're receiving this because Weekly Digest is enabled in Bloomy.",
    "To unsubscribe, open Settings → Notifications → Weekly Farm Digest in the app."
  );
  return lines.join("\n");
}

// ── Public sender ─────────────────────────────────────────────────────────────

export async function sendDigestEmail(data: DigestEmailData): Promise<void> {
  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    logger.warn("Weekly digest email: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL not set — skipping email");
    return;
  }

  const subject =
    data.totalAlerts === 0 && data.totalNotes === 0
      ? `Bloomy Digest: All farms clear this week`
      : `Bloomy Digest: ${data.totalAlerts + data.totalNotes} item${data.totalAlerts + data.totalNotes !== 1 ? "s" : ""} need${data.totalAlerts + data.totalNotes === 1 ? "s" : ""} your attention`;

  try {
    await sgMail.send({
      to: { email: data.toEmail, name: data.toName ?? undefined },
      from: { email: FROM_EMAIL, name: "Bloomy" },
      subject,
      html: buildHtml(data),
      text: buildText(data),
    });
  } catch (err) {
    logger.error({ err, email: data.toEmail }, "Weekly digest email: SendGrid error");
    throw err;
  }
}
