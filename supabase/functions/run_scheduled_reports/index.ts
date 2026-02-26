// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase-js";
import parser from "cron-parser";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "default-local-secret";

interface RunRequest {
    manual_report_id?: string;
}

serve(async (req) => {
    try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        let manualReportId: string | undefined;

        // 1. Authorization checks
        const authHeader = req.headers.get("Authorization") || "";
        if (req.method === "POST" && req.headers.get("Content-Type")?.includes("application/json")) {
            const body: RunRequest = await req.json().catch(() => ({}));
            manualReportId = body.manual_report_id;
        }

        if (manualReportId) {
            // Manual trigger: verify user Token
            const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                global: { headers: { Authorization: authHeader } }
            });
            const { data: { user } } = await userClient.auth.getUser();
            if (!user) throw new Error("Unauthorized to run manual report");

            // Check if user is admin or owner
            // Quickest way is to attempt to fetch the report using the user's RLS token or manually verify
            const { data: report, error } = await supabaseAdmin
                .from("scheduled_reports")
                .select("owner_id")
                .eq("id", manualReportId)
                .single();

            if (error || !report) throw new Error("Report not found");

            const { data: userData } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
            const isAdmin = userData?.role === "admin";

            if (!isAdmin && report.owner_id !== user.id) {
                throw new Error("Forbidden: Not owner or admin");
            }
        } else {
            // Background Cron Trigger: verify secret
            if (authHeader !== `Bearer ${CRON_SECRET}`) {
                throw new Error("Unauthorized cron trigger");
            }
        }

        // 2. Fetch Due Reports (or the specific manual one)
        let query = supabaseAdmin
            .from("scheduled_reports")
            .select("id, name, filters, format, recipients, schedule_cron, last_run_at, next_run_at")
            .eq("is_active", true);

        if (manualReportId) {
            query = query.eq("id", manualReportId);
        } else {
            // Is overdue or has never run (next_run_at is null but cron is set)
            // The `or` condition should be applied to the base query, and then the `not` condition.
            // This ensures the `not` condition applies to the results of the `or` and `is_active` conditions.
            query = query
                .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`)
                .not("schedule_cron", "is", null);
        }

        const { data: dueReports, error: fetchErr } = await query;

        if (fetchErr) {
            throw new Error(`Failed to fetch schedules: ${fetchErr.message}`);
        }

        if (!dueReports || dueReports.length === 0) {
            return new Response(JSON.stringify({ message: "No reports due." }), { status: 200 });
        }

        const results = [];

        // 3. Process each due report
        for (const report of dueReports) {
            try {
                // If this is a natural cron run (not manual), calculate and update next_run_at BEFORE executing
                // to prevent overlapping concurrent cron sweeps from duplicate firing.
                if (!manualReportId && report.schedule_cron) {
                    const interval = parser.parseExpression(report.schedule_cron);
                    const nextRun = interval.next().toDate();

                    const { error: updateErr } = await supabaseAdmin
                        .from("scheduled_reports")
                        .update({
                            next_run_at: nextRun.toISOString(),
                            last_run_at: new Date().toISOString()
                        })
                        .eq("id", report.id);

                    if (updateErr) {
                        console.error(`Failed to lock next_run_at for report ${report.id}`, updateErr);
                        continue; // Skip execution if we couldn't lock it
                    }
                } else if (manualReportId) {
                    // For manual runs, just update last_run_at
                    await supabaseAdmin
                        .from("scheduled_reports")
                        .update({ last_run_at: new Date().toISOString() })
                        .eq("id", report.id);
                }

                // 4. Dispatch the 'generate_report' edge function
                const dispatchPayload = {
                    scheduled_report_id: report.id,
                    filters: report.filters || {},
                    format: report.format || "csv",
                    recipients: report.recipients || [],
                    entity: report.filters?.entity || "aggregates"
                };

                const { error: invokeErr } = await supabaseAdmin.functions.invoke("generate_report", {
                    body: dispatchPayload
                });

                if (invokeErr) {
                    throw new Error(`Invocation failed: ${invokeErr.message || JSON.stringify(invokeErr)}`);
                }

                results.push({ id: report.id, status: "dispatched" });

            } catch (err) {
                console.error(`Error processing report ${report.id}:`, err);
                results.push({ id: report.id, status: "failed", error: String(err) });
            }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: errorMsg }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        });
    }
});
