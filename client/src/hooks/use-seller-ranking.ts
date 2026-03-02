import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export interface SellerRankingEntry {
    sellerId: string;
    sellerName: string;
    enrollments: number;
    revenue: number;
    conversionRate: number;
    avgTicket: number;
}

export function useSellerRanking(schoolId: string | undefined, filters?: { from?: Date; to?: Date }) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", format(filters.from, "yyyy-MM-dd"));
    if (filters?.to) params.set("to", format(filters.to, "yyyy-MM-dd"));
    const qs = params.toString();

    return useQuery<SellerRankingEntry[]>({
        queryKey: ["/api/schools", schoolId, "sellers-ranking", qs],
        queryFn: async () => {
            const res = await fetch(
                `/api/schools/${schoolId}/sellers-ranking${qs ? `?${qs}` : ""}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch seller ranking");
            return res.json();
        },
        enabled: !!schoolId && !!filters?.from && !!filters?.to,
    });
}
