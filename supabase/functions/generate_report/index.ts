// @ts-nocheck
import { serve } from "std/http/server.ts";
import { createClient } from "supabase-js";
import { stringify } from "std/csv/stringify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
const BACKEND_URL = Deno.env.get("BACKEND_URL") || "http://host.docker.internal:3000";

interface ReportRequest {
    scheduled_report_id?: string;
    filters: Record<string, unknown>;
    format: "csv" | "pdf";
    recipients?: string[];
    entity: "kpi_values" | "aggregates" | "comparisons";
    initiated_by?: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: req.headers.get("Authorization")! } },
        });

        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        // In a prod scenario, this might also be called by pg_cron which lacks a standard user context,
        // so we fallback to verifying service role if needed, or allowing unauthenticated if internal
        // (though best practice is pg_net calls this with service role token).

        // For now we assume a valid user or service role.
        const isAdminMode = req.headers.get("Authorization")?.includes(SUPABASE_SERVICE_ROLE_KEY);

        if (!user && !isAdminMode) {
            throw new Error("Unauthorized");
        }

        const payload: ReportRequest = await req.json();
        const { scheduled_report_id, filters, format, recipients, entity, initiated_by } = payload;
        const initiatorId = user?.id || initiated_by;

        if (!initiatorId && !scheduled_report_id) {
            throw new Error("Must provide initiator or scheduled report ID");
        }

        // 1. Fetch data from our Node Backend
        // In a real microservice architecture, we'd GET from our internal /api/query
        const queryParams = new URLSearchParams({
            entity: entity || "aggregates",
            limit: "10000",
            ...filters as any,
        });

        const backendRes = await fetch(`${BACKEND_URL}/api/query?${queryParams.toString()}`, {
            headers: {
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            }
        });

        if (!backendRes.ok) {
            const err = await backendRes.text();
            console.error("Backend fetch error:", err);
            throw new Error("Failed to fetch data for report");
        }

        const { data: reportData } = await backendRes.json();

        if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
            return new Response(JSON.stringify({ message: "No data found for these filters" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404,
            });
        }

        let fileBuffer: ArrayBuffer | Uint8Array;
        let mimeType = "";

        // 2. Format Data
        if (format === "csv") {
            const columns = Object.keys(reportData[0]);
            const csvStr = stringify(reportData, { columns });
            fileBuffer = new TextEncoder().encode(csvStr);
            mimeType = "text/csv";
        } else if (format === "pdf") {
            if (!PDFSHIFT_API_KEY) {
                throw new Error("PDF generation is not configured (missing API key)");
            }

            // Simple HTML render
            const headers = Object.keys(reportData[0]);
            let html = `<html><head><style>table {width: 100%; border-collapse: collapse;} th, td {border: 1px solid #ddd; padding: 8px;} th {background-color: #f2f2f2;}</style></head><body>`;
            html += `<h2>Report Export: ${entity}</h2><table><thead><tr>`;
            headers.forEach(h => html += `<th>${h}</th>`);
            html += `</tr></thead><tbody>`;
            reportData.forEach((row: any) => {
                html += `<tr>`;
                headers.forEach(h => html += `<td>${row[h] ?? ''}</td>`);
                html += `</tr>`;
            });
            html += `</tbody></table></body></html>`;

            // Call PDFShift (or alternative) with simple retry logic for rate limits
            let pdfRes: Response | null = null;
            let retries = 3;
            while (retries > 0) {
                pdfRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${btoa("api:" + PDFSHIFT_API_KEY)}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        source: html,
                        landscape: true,
                        margin: "1cm"
                    })
                });

                if (pdfRes.ok) break;
                if (pdfRes.status === 429) {
                    // Rate limited: wait 2 seconds and retry
                    await new Promise(r => setTimeout(r, 2000));
                    retries--;
                } else {
                    break; // Other error, don't retry naturally
                }
            }

            if (!pdfRes || !pdfRes.ok) {
                const err = await pdfRes?.text() || "Unknown PDF generation error";
                throw new Error(`PDF generation failed: ${err}`);
            }
            fileBuffer = new Uint8Array(await pdfRes.arrayBuffer());
            mimeType = "application/pdf";
        } else {
            throw new Error("Unsupported format");
        }

        // 3. Upload to Supabase Storage
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const datePath = new Date().toISOString().split('T')[0].replace(/-/g, '/');
        const folder = scheduled_report_id || 'manual';
        const filename = `${crypto.randomUUID()}.${format}`;
        const filePath = `${folder}/${datePath}/${filename}`;

        const { error: uploadErr } = await adminClient.storage
            .from("reports-exports")
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadErr) {
            throw new Error(`Storage upload failed: ${uploadErr.message}`);
        }

        // 4. Create record in report_exports
        const { data: exportRecord, error: dbErr } = await adminClient
            .from("report_exports")
            .insert({
                scheduled_report_id: scheduled_report_id || null,
                initiated_by: initiatorId,
                format,
                file_path: filePath,
                status: "success",
            })
            .select("id")
            .single();

        if (dbErr) {
            throw new Error(`DB insert failed: ${dbErr.message}`);
        }

        // 5. Send Email if requested
        if (recipients && recipients.length > 0 && SENDGRID_API_KEY) {
            // Send an email via SendGrid containing a link to our backend download router
            const downloadUrl = `${BACKEND_URL}/api/reports/exports/${exportRecord.id}/download`;

            const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${SENDGRID_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    personalizations: [{ to: recipients.map(email => ({ email })) }],
                    from: { email: "reports@yourplatform.com", name: "Reporting System" },
                    subject: `Your ${format.toUpperCase()} Report is Ready`,
                    content: [{
                        type: "text/html",
                        value: `
               <h2>Report Generation Complete</h2>
               <p>Your requested report is available for download natively for the next 90 days.</p>
               <br/>
               <a href="${downloadUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                 Download Report
               </a>
             `
                    }]
                })
            });

            if (!sgRes.ok) {
                console.error("Failed to send email via SendGrid:", await sgRes.text());
            }
        }

        return new Response(JSON.stringify({
            success: true,
            export_id: exportRecord.id,
            message: "Report successfully generated"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Generate report function error:", error);
        const message = error instanceof Error ? error.message : "Internal Server Error";

        // Attempt to log failure if we had enough to make an export record
        // Usually handled by a wrapper or the caller tracking pending state.

        return new Response(JSON.stringify({ success: false, message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
