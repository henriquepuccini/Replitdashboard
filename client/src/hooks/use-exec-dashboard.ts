import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { NetworkAggregate, SchoolComparison } from "@shared/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecDashboardFilters {
    from?: Date;
    to?: Date;
}

export interface ComparisonFilters extends ExecDashboardFilters {
    metricKey?: string;
    limit?: number;
    offset?: number;
}

export type ExportFormat = "csv" | "pdf";

// ---------------------------------------------------------------------------
// useNetworkAggregates
// GET /api/network-aggregates?from=&to=
// ---------------------------------------------------------------------------

export function useNetworkAggregates(filters?: ExecDashboardFilters) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    const qs = params.toString();

    return useQuery<NetworkAggregate[]>({
        queryKey: ["/api/network-aggregates", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/network-aggregates${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch network aggregates");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// useSchoolComparison
// GET /api/school-comparisons?metric_key=&from=&to=&limit=&offset=
// ---------------------------------------------------------------------------

export function useSchoolComparison(filters?: ComparisonFilters) {
    const params = new URLSearchParams();
    if (filters?.metricKey) params.set("metric_key", filters.metricKey);
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    params.set("limit", String(filters?.limit ?? 50));
    params.set("offset", String(filters?.offset ?? 0));
    const qs = params.toString();

    return useQuery<SchoolComparison[]>({
        queryKey: ["/api/school-comparisons", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/school-comparisons${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch school comparisons");
            return res.json();
        },
        staleTime: 3 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// exportExecDashboard
// POST /api/exec/export — CSV fallback from network aggregates data
// ---------------------------------------------------------------------------

export async function exportExecDashboard(
    filters: ExecDashboardFilters & { metricKey?: string },
    exportFormat: ExportFormat,
    fallbackData?: NetworkAggregate[]
): Promise<void> {
    const periodLabel = [
        filters.from ? format(filters.from, "yyyy-MM-dd") : "all",
        filters.to ? format(filters.to, "yyyy-MM-dd") : "today",
    ].join("_to_");

    try {
        const res = await fetch("/api/exec/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ format: exportFormat, ...filters }),
        });
        if (!res.ok) throw new Error("Export endpoint unavailable");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `exec_dashboard_${periodLabel}.${exportFormat}`;
        link.click();
        URL.revokeObjectURL(url);
    } catch {
        // Fallback: CSV from NetworkAggregates
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
        link.download = `exec_dashboard_${periodLabel}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
