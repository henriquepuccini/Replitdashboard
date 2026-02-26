// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

// Database Types
interface SLA {
    connector_id: string;
    max_latency_ms: number;
    success_rate_threshold: number;
}

interface MetricSummary {
    connector_id: string;
    total_runs: number;
    failed_runs: number;
    avg_latency: number;
}

interface AlertParams {
    connector_id: string;
    alert_type: string;
    severity: string;
    message: string;
    metadata: any;
}

serve(async (req) => {
    try {
        // 1. Initialize Supabase client using Service Role key
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase environment variables');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log("Starting health check scan...");

        // 2. Fetch all SLAs
        const { data: slas, error: slaError } = await supabase
            .from('connector_slas')
            .select('connector_id, max_latency_ms, success_rate_threshold');

        if (slaError) throw slaError;
        if (!slas || slas.length === 0) {
            return new Response(JSON.stringify({ message: "No SLAs defined" }), { status: 200 });
        }

        // Determine time window (e.g., last 15 minutes)
        const timeWindowMinutes = 15;
        const sinceDate = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

        // 3. For each SLA, check recent metrics
        const alertsToCreate: AlertParams[] = [];

        for (const sla of slas) {
            const { data: metrics, error: metricsError } = await supabase
                .from('connector_metrics')
                .select('status, duration_ms')
                .eq('connector_id', sla.connector_id)
                .gte('created_at', sinceDate);

            if (metricsError) {
                console.error(`Error fetching metrics for ${sla.connector_id}:`, metricsError);
                continue;
            }

            // If no runs in the last window, it might be fine (or maybe it should alert if we expect continuous runs)
            // For now, we only alert on *failed* runs or *slow* runs.
            if (!metrics || metrics.length === 0) continue;

            const totalRuns = metrics.length;
            const failedRuns = metrics.filter(m => m.status === 'failed').length;
            const successRate = ((totalRuns - failedRuns) / totalRuns) * 100;

            const avgLatency = metrics.reduce((acc, curr) => acc + curr.duration_ms, 0) / totalRuns;

            // Check SLA breaches
            let breached = false;
            let alertMsg = "";

            if (successRate < sla.success_rate_threshold) {
                breached = true;
                alertMsg += `Success rate ${successRate.toFixed(1)}% is below threshold ${sla.success_rate_threshold}%. `;
            }

            if (avgLatency > sla.max_latency_ms) {
                breached = true;
                alertMsg += `Avg latency ${avgLatency.toFixed(0)}ms is above threshold ${sla.max_latency_ms}ms.`;
            }

            if (breached) {
                // Evaluate if an open alert exists
                const { data: existingAlerts } = await supabase
                    .from('integration_alerts')
                    .select('id')
                    .eq('connector_id', sla.connector_id)
                    .eq('alert_type', 'sla_breach')
                    .in('status', ['open', 'acknowledged'])
                    .limit(1);

                // Deduplication: Only create if no active alert exists
                if (!existingAlerts || existingAlerts.length === 0) {
                    alertsToCreate.push({
                        connector_id: sla.connector_id,
                        alert_type: 'sla_breach',
                        severity: successRate < (sla.success_rate_threshold - 10) ? 'critical' : 'warning',
                        message: alertMsg.trim(),
                        metadata: {
                            measured_success_rate: successRate,
                            measured_avg_latency: avgLatency,
                            total_runs: totalRuns,
                            time_window_mins: timeWindowMinutes
                        }
                    });
                }
            }
        }

        // 4. Batch insert new alerts
        if (alertsToCreate.length > 0) {
            const { error: insertError } = await supabase
                .from('integration_alerts')
                .insert(alertsToCreate);

            if (insertError) {
                console.error("Failed to insert new alerts:", insertError);
                throw insertError;
            }
            console.log(`Created ${alertsToCreate.length} new alerts.`);
        }

        return new Response(
            JSON.stringify({
                status: 'ok',
                alerts_created: alertsToCreate.length
            }),
            { headers: { "Content-Type": "application/json" }, status: 200 }
        );

    } catch (err: any) {
        console.error("Health check execution failed:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { "Content-Type": "application/json" }, status: 500 }
        );
    }
});
