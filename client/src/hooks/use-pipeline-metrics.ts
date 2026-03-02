import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export interface PipelineMetricsResult {
    metrics: {
        totalLeads: number;
        totalEnrollments: number;
        conversionRate: number;
    };
    schoolAvgConversion: number;
    goal: number | null;
    timePerStage: Record<string, number>;
}

export function usePipelineMetrics(
    sellerId: string | undefined,
    filters?: { from?: Date; to?: Date; school_id?: string }
) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    if (filters?.school_id && filters.school_id !== "all") {
        params.set("school_id", filters.school_id);
    }
    const qs = params.toString();

    return useQuery<PipelineMetricsResult>({
        queryKey: ["/api/sellers", sellerId, "pipeline-metrics", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/sellers/${sellerId}/pipeline-metrics${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch pipeline metrics");
            return res.json();
        },
        enabled: !!sellerId && !!filters?.from && !!filters?.to,
    });
}

export function useUpdatePipelineGoal(sellerId: string | undefined) {
    return useMutation({
        mutationFn: async ({
            target,
            periodStart,
            periodEnd,
        }: {
            target: number;
            periodStart: string;
            periodEnd: string;
        }) => {
            const res = await apiRequest("POST", `/api/sellers/${sellerId}/pipeline-goal`, {
                target,
                periodStart,
                periodEnd,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                predicate: (query) =>
                    Array.isArray(query.queryKey) &&
                    query.queryKey[0] === "/api/sellers" &&
                    query.queryKey[2] === "pipeline-metrics",
            });
        },
    });
}
