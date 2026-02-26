// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ChurnRuleCondition {
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "older_than_days";
    value: any;
}

interface ChurnRuleConfig {
    source: "lead" | "enrollment";
    conditions: ChurnRuleCondition[];
}

interface RunPayload {
    rule_id: string;
    school_id?: string;
    dry_run?: boolean;
}

// Convert a UUID string to a 32-bit int for pg_try_advisory_lock
function uuidToLockId(uuidStr: string): number {
    let hash = 0;
    for (let i = 0; i < uuidStr.length; i++) {
        const char = uuidStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit int
    }
    return hash;
}

serve(async (req) => {
    let responseData: { success: boolean, message: string, stats?: any } = { success: false, message: "" };
    let statusCode = 400;

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        // Auth Check
        const { data: { user } } = await supabaseClient.auth.getUser();
        const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

        if (!user && !isServiceRole) {
            throw new Error("Unauthorized");
        }

        const payload: RunPayload = await req.json();
        const { rule_id, school_id, dry_run = false } = payload;

        if (!rule_id) {
            throw new Error("Missing rule_id");
        }

        // 1. Get Service Role Admin Client to bypass RLS for processing overhead
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 2. Fetch the Rule Config
        const { data: rule, error: ruleErr } = await adminClient
            .from("churn_rules")
            .select("*")
            .eq("id", rule_id)
            .single();

        if (ruleErr || !rule) {
            throw new Error(`Rule not found: ${ruleErr?.message}`);
        }

        if (!rule.is_active) {
            throw new Error("Rule is inactive");
        }

        // Target school is either explicitly passed or inherited from the rule record natively
        const targetSchoolId = school_id || rule.school_id;
        if (!targetSchoolId && rule.config?.source !== "network_global") {
            throw new Error("school_id is required either in payload or rule record");
        }

        // 3. Concurrency Lock: Use RPC call to pg_try_advisory_lock
        const lockId = uuidToLockId(rule_id);
        const { data: lockAcquired, error: lockErr } = await adminClient.rpc("acquire_advisory_lock", { lock_id: lockId }).single();

        // If we don't have the RPC setup, we'll gracefully degrade to running without it, 
        // but in a production environment with cron sweeping, a lock is highly requested.
        // For now, if the RPC fails entirely (e.g. not created), we assume we can proceed, 
        // but if it explicitly returns false, we abort.
        if (lockAcquired === false) {
            statusCode = 409;
            throw new Error("Rule execution already in progress (lock conflict)");
        }

        let processedRecords = 0;
        let churnedRecords = 0;
        const runStartTime = new Date().toISOString();

        try {
            // 4. Evaluate Rule DSL
            const config = rule.config as ChurnRuleConfig;
            const sourceTable = config.source === "lead" ? "leads" : "enrollments";

            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                // Construct base query
                let query = adminClient
                    .from(sourceTable)
                    .select("*")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (targetSchoolId) {
                    query = query.eq("school_id", targetSchoolId);
                }

                // Apply DSL filters
                if (config.conditions && Array.isArray(config.conditions)) {
                    for (const cond of config.conditions) {
                        switch (cond.operator) {
                            case "eq": query = query.eq(cond.field, cond.value); break;
                            case "neq": query = query.neq(cond.field, cond.value); break;
                            case "gt": query = query.gt(cond.field, cond.value); break;
                            case "lt": query = query.lt(cond.field, cond.value); break;
                            case "older_than_days": {
                                const thresholdDate = new Date();
                                thresholdDate.setDate(thresholdDate.getDate() - parseInt(cond.value, 10));
                                query = query.lt(cond.field, thresholdDate.toISOString());
                                break;
                            }
                        }
                    }
                }

                const { data: batch, error: batchErr } = await query;
                if (batchErr) throw new Error(`Batch fetch failed: ${batchErr.message}`);

                if (!batch || batch.length === 0) {
                    hasMore = false;
                    break;
                }

                processedRecords += batch.length;

                // Everything returned by the DSL query is considered mathematically "churned" by definition
                const churnEventsToInsert = batch.map((record: any) => ({
                    source_type: config.source,
                    source_id: String(record.id),
                    school_id: record.school_id,
                    churn_flag: true,
                    churn_reason: `Rule Eval: ${rule.name}`,
                    detected_by: "engine",
                    payload: { rule_id: rule.id, snapshot: record }
                }));

                churnedRecords += churnEventsToInsert.length;

                // 5. Persist Churn Events (Skip if dry run)
                if (!dry_run && churnEventsToInsert.length > 0) {
                    const { error: insertErr } = await adminClient
                        .from("churn_events")
                        .insert(churnEventsToInsert);

                    if (insertErr) {
                        console.error(`Failed to insert ${churnEventsToInsert.length} events:`, insertErr);
                        // We log but continue, or fail the batch. Let's fail the run safely.
                        throw insertErr;
                    }
                }

                if (batch.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            // 6. Record the Run Audit Log
            if (!dry_run) {
                await adminClient.from("churn_runs").insert({
                    rule_id: rule_id,
                    started_at: runStartTime,
                    finished_at: new Date().toISOString(),
                    processed_records: processedRecords
                });
            }

            statusCode = 200;
            responseData = {
                success: true,
                message: dry_run ? "[DRY RUN] Churn eval complete" : "Churn rule executed successfully",
                stats: {
                    processed: processedRecords,
                    churned: churnedRecords,
                    dry_run
                }
            };

        } finally {
            // 7. Release lock if we had one
            if (lockAcquired === true) {
                await adminClient.rpc("release_advisory_lock", { lock_id: lockId });
            }
        }

    } catch (err: any) {
        console.error("Churn run failed:", err);
        responseData = { success: false, message: err.message || String(err) };
    }

    return new Response(JSON.stringify(responseData), {
        headers: { "Content-Type": "application/json" },
        status: statusCode,
    });
});
