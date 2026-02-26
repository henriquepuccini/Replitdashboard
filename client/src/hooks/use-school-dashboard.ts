import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SchoolAggregate, KpiDefinition, KpiValue, KpiGoal } from "@shared/schema";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchoolKpisResult = {
    definitions: KpiDefinition[];
    values: KpiValue[];
    goals: KpiGoal[];
};

export type ExportFormat = "csv" | "pdf";

// ---------------------------------------------------------------------------
// useSchoolAggregates
// Fetches pre-computed school_aggregates rows for [from, to] date range.
// ---------------------------------------------------------------------------

export function useSchoolAggregates(
    schoolId: string | undefined,
    filters?: { from?: Date; to?: Date }
) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    const qs = params.toString();

    return useQuery<SchoolAggregate[]>({
        queryKey: ["/api/schools", schoolId, "aggregates", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/schools/${schoolId}/aggregates${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch school aggregates");
            return res.json();
        },
        enabled: !!schoolId,
        staleTime: 5 * 60 * 1000, // 5 min — aggregates refresh slowly
    });
}

// ---------------------------------------------------------------------------
// useSchoolKpis
// Fetches KPI definitions, values, and goals in one request for the school.
// Returns { definitions, values, goals }.
// ---------------------------------------------------------------------------

export function useSchoolKpis(
    schoolId: string | undefined,
    filters?: { from?: Date; to?: Date }
) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    const qs = params.toString();

    return useQuery<SchoolKpisResult>({
        queryKey: ["/api/schools", schoolId, "kpis", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/schools/${schoolId}/kpis${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch school KPIs");
            return res.json();
        },
        enabled: !!schoolId,
        staleTime: 2 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// useUpdateSchoolKpiGoal
// Wraps the existing PATCH /api/kpis/:kpiId/goals/:goalId endpoint.
// ---------------------------------------------------------------------------

export function useUpdateSchoolKpiGoal(schoolId: string | undefined) {
    return useMutation({
        mutationFn: async ({
            kpiId,
            goalId,
            target,
        }: {
            kpiId: string;
            goalId: string;
            target: string;
        }) => {
            const res = await apiRequest("PATCH", `/api/kpis/${kpiId}/goals/${goalId}`, {
                target,
            });
            return res.json();
        },
        onSuccess: () => {
            // Invalidate both the school KPI query and the generic goals query
            queryClient.invalidateQueries({
                predicate: (query) =>
                    Array.isArray(query.queryKey) &&
                    (query.queryKey[0] === "/api/schools" ||
                        query.queryKey[0] === "/api/kpis"),
            });
        },
    });
}

// ---------------------------------------------------------------------------
// exportSchoolDashboard
// Posts to the export edge function and triggers a browser download.
// Falls back to client-side CSV generation if the endpoint isn't deployed.
// ---------------------------------------------------------------------------

export async function exportSchoolDashboard(
    schoolId: string,
    periodLabel: string,
    format: ExportFormat,
    fallbackData?: SchoolAggregate[]
): Promise<void> {
    try {
        const res = await apiRequest("POST", `/api/schools/${schoolId}/export`, {
            format,
            period: periodLabel,
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `dashboard_escolar_${schoolId}_${periodLabel}.${format}`;
        link.click();
        URL.revokeObjectURL(url);
    } catch {
        // Fallback: client-side CSV from aggregates data
        if (!fallbackData?.length) return;
        const header = "Data,Metric,Valor\n";
        const rows = fallbackData.flatMap((agg) =>
            Object.entries(agg.metrics).map(
                ([key, val]) => `${agg.date},${key},${val}`
            )
        );
        const csv = header + rows.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `dashboard_escolar_${schoolId}_${periodLabel}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
