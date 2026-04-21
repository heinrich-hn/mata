import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface JobCardPayload {
    to: string;
    cc?: string;
    recipientName?: string;
    jobNumber: string;
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
    createdAt?: string | null;
    vehicleRegistration?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
    totalCost?: number | null;
    partsCount?: number | null;
    laborHours?: number | null;
    pdfBase64: string; // base64-encoded PDF (no data:... prefix)
    pdfFileName: string;
    senderName?: string;
    message?: string; // optional custom note from the sender
}

function buildHtml(p: JobCardPayload): string {
    const vehicle = [
        p.vehicleRegistration,
        p.vehicleMake && p.vehicleModel ? `${p.vehicleMake} ${p.vehicleModel}` : null,
    ]
        .filter(Boolean)
        .join(" — ") || "—";
    const dueDate = p.dueDate
        ? new Date(p.dueDate).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
        })
        : "—";
    const status = (p.status || "pending").toUpperCase();
    const priority = (p.priority || "medium").toUpperCase();
    const greetingName = p.recipientName?.split(" ")[0] || "Hi";

    const statusColor = (() => {
        const s = (p.status || "").toLowerCase();
        if (s === "completed") return { bg: "#dcfce7", fg: "#166534" };
        if (s === "in_progress") return { bg: "#dbeafe", fg: "#1e40af" };
        if (s === "on_hold") return { bg: "#fef3c7", fg: "#92400e" };
        return { bg: "#f3f4f6", fg: "#374151" };
    })();
    const priorityColor = (() => {
        const s = (p.priority || "").toLowerCase();
        if (s === "urgent") return { bg: "#fee2e2", fg: "#991b1b" };
        if (s === "high") return { bg: "#ffedd5", fg: "#9a3412" };
        if (s === "low") return { bg: "#f3f4f6", fg: "#4b5563" };
        return { bg: "#e0f2fe", fg: "#075985" };
    })();

    const totalCostFmt = typeof p.totalCost === "number"
        ? `R ${p.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—";

    const customMessage = p.message
        ? `<p style="margin:16px 0 0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-line">${escapeHtml(p.message)}</p>`
        : "";

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:600;letter-spacing:-0.01em;">Workshop Job Card</h1>
            <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">MATA Fleet Management</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 4px;color:#111827;font-size:15px;">${escapeHtml(greetingName)},</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
              Please find attached job card
              <strong>${escapeHtml(p.jobNumber)}</strong>${p.title ? ` — ${escapeHtml(p.title)}` : ""}${p.vehicleRegistration ? ` for vehicle <strong>${escapeHtml(p.vehicleRegistration)}</strong>` : ""}.
            </p>
            ${customMessage}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;">
              ${row("Job #", p.jobNumber)}
              ${p.title ? row("Title", p.title) : ""}
              ${row("Vehicle", vehicle)}
              ${row("Assignee", p.assignee || "Unassigned")}
              ${row("Due Date", dueDate)}
              ${row("Status", `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${statusColor.bg};color:${statusColor.fg};font-size:11px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(status)}</span>`, true)}
              ${row("Priority", `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${priorityColor.bg};color:${priorityColor.fg};font-size:11px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(priority)}</span>`, true)}
              ${typeof p.partsCount === "number" ? row("Parts", String(p.partsCount)) : ""}
              ${typeof p.laborHours === "number" ? row("Labour Hours", `${p.laborHours.toFixed(1)} h`) : ""}
              ${typeof p.totalCost === "number" ? row("Total Cost", `<strong style="color:#0f172a;">${escapeHtml(totalCostFmt)}</strong>`, true) : ""}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
              The full PDF report is attached to this email.${p.senderName ? ` Sent on behalf of <strong>${escapeHtml(p.senderName)}</strong>.` : ""}
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">
              MATA Fleet Management &bull; Automated message — please do not reply directly.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string, isHtml = false): string {
    return `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;width:130px;">${escapeHtml(label)}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;">${isHtml ? value : escapeHtml(value)}</td>
  </tr>`;
}

function escapeHtml(input: string): string {
    return String(input ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    try {
        const payload = (await req.json()) as JobCardPayload;

        if (!payload?.to || !payload.pdfBase64 || !payload.pdfFileName || !payload.jobNumber) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: to, pdfBase64, pdfFileName, jobNumber" }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
        }

        const subject = `Job Card ${payload.jobNumber}${payload.vehicleRegistration ? ` — ${payload.vehicleRegistration}` : ""}`;
        const html = buildHtml(payload);

        // Sender override via INSPECTION_FROM_EMAIL secret (shared with the
        // inspection report function so a single verified address covers both).
        const fromAddress =
            Deno.env.get("INSPECTION_FROM_EMAIL") ||
            "MATA Fleet <onboarding@resend.dev>";

        const { error } = await resend.emails.send({
            from: fromAddress,
            to: [payload.to],
            cc: payload.cc ? [payload.cc] : undefined,
            subject,
            html,
            attachments: [
                {
                    filename: payload.pdfFileName,
                    content: payload.pdfBase64,
                },
            ],
        });

        if (error) {
            console.error("Resend error:", error);
            return new Response(
                JSON.stringify({ error: error.message || "Failed to send email" }),
                { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
    } catch (err) {
        console.error("send-job-card-report error:", err);
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
    }
});
