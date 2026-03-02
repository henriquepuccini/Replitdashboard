import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CeoKpiEntry {
    kpiId: string;
    key: string;
    name: string;
    value: number | null;
    metadata: Record<string, unknown> | null;
    computedAt: string | null;
}

export type CeoKpiMap = Record<string, CeoKpiEntry>;

export interface UseCeoKpisFilters {
    from?: Date;
    to?: Date;
    schoolId?: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCeoKpis(filters?: UseCeoKpisFilters) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    if (filters?.schoolId) params.set("school_id", filters.schoolId);
    const qs = params.toString();

    return useQuery<CeoKpiMap>({
        queryKey: ["/api/ceo-kpis", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/ceo-kpis${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch CEO KPIs");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}
