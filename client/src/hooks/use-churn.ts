import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChurnRule, ChurnEvent, ChurnRun } from "@shared/schema";

export function useChurnRules() {
    return useQuery<ChurnRule[]>({
        queryKey: ["/api/churn-rules"],
    });
}

export function useCreateChurnRule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (rule: Partial<ChurnRule>) => {
            const res = await fetch("/api/churn-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rule),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/churn-rules"] });
        },
    });
}

export function useUpdateChurnRule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...rule }: Partial<ChurnRule> & { id: string }) => {
            const res = await fetch(`/api/churn-rules/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rule),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/churn-rules"] });
        },
    });
}

export function useDeleteChurnRule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/churn-rules/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(await res.text());
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/churn-rules"] });
        },
    });
}

export function useChurnEvents(filters?: { school_id?: string; source_type?: string; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (filters?.school_id) queryParams.append("school_id", filters.school_id);
    if (filters?.source_type) queryParams.append("source_type", filters.source_type);
    if (filters?.limit) queryParams.append("limit", filters.limit.toString());

    return useQuery<(ChurnEvent & { school_name: string })[]>({
        queryKey: ["/api/churn-events", filters],
        queryFn: async () => {
            const res = await fetch(`/api/churn-events?${queryParams.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch events");
            return res.json();
        }
    });
}

export function useChurnRuns(ruleId?: string) {
    return useQuery<ChurnRun[]>({
        queryKey: ["/api/churn-runs", ruleId],
        queryFn: async () => {
            const res = await fetch(ruleId ? `/api/churn-runs?rule_id=${ruleId}` : `/api/churn-runs`);
            if (!res.ok) throw new Error("Failed to fetch runs");
            return res.json();
        },
        enabled: !!ruleId
    });
}

interface RunChurnVars {
    ruleId: string;
    dryRun?: boolean;
}

export function useRunChurnRule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ ruleId, dryRun }: RunChurnVars) => {
            const res = await fetch(`/api/churn-rules/${ruleId}/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dry_run: dryRun })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Execution failed");
            return data;
        },
        onSuccess: (_, vars) => {
            if (!vars.dryRun) {
                queryClient.invalidateQueries({ queryKey: ["/api/churn-runs"] });
                queryClient.invalidateQueries({ queryKey: ["/api/churn-events"] });
            }
        }
    });
}

// ─── Churn Motives (migration 033) ────────────────────────────────────────────

export interface ChurnMotiveCatalog {
    id: string;
    code: string;
    label: string;
    description: string | null;
    isCritical: boolean;
    sortOrder: number;
}

export interface ChurnBreakdownItem {
    motiveId: string | null;
    code: string;
    label: string;
    isCritical: boolean;
    count: number;
    ltvLostTotal: number;
}

export interface ChurnBreakdown {
    breakdown: ChurnBreakdownItem[];
    totalCancellations: number;
    adaptationRate: number;
}

/** Fetch the full churn motive catalog (5 preset categories). */
export function useChurnMotives() {
    return useQuery<ChurnMotiveCatalog[]>({
        queryKey: ["/api/churn-motives"],
    });
}

/** Breakdown of cancellations by motive, optionally scoped to a school and period. */
export function useChurnBreakdown(params?: {
    schoolId?: string;
    from?: string;
    to?: string;
}) {
    const qs = new URLSearchParams();
    if (params?.schoolId) qs.append("school_id", params.schoolId);
    if (params?.from) qs.append("from", params.from);
    if (params?.to) qs.append("to", params.to);

    return useQuery<ChurnBreakdown>({
        queryKey: ["/api/churn-motives/breakdown", params],
        queryFn: async () => {
            const res = await fetch(`/api/churn-motives/breakdown?${qs.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch churn breakdown");
            return res.json();
        },
        enabled: !!params?.schoolId,
    });
}

/** Cancel an enrollment and record the motive. LTV lost is auto-computed server-side. */
export function useCancelEnrollment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            enrollmentId,
            churnMotiveId,
            churnNotes,
        }: {
            enrollmentId: string;
            churnMotiveId?: string;
            churnNotes?: string;
        }) => {
            const res = await fetch(`/api/enrollments/${enrollmentId}/cancel`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ churnMotiveId, churnNotes }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/churn-motives/breakdown"] });
        },
    });
}
