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
