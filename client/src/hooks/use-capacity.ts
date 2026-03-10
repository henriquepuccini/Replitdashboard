import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SchoolCapacity, InsertSchoolCapacity } from "@shared/schema";

export function useSchoolCapacity(schoolId?: string | null) {
    return useQuery<SchoolCapacity[]>({
        queryKey: ["/api/schools", schoolId, "capacity"],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/capacity`);
            if (!res.ok) throw new Error("Failed to fetch capacity");
            return res.json();
        },
        enabled: !!schoolId,
    });
}

export function useCreateCapacity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: InsertSchoolCapacity) => {
            const res = await apiRequest("POST", `/api/schools/${data.schoolId}/capacity`, data);
            return res.json() as Promise<SchoolCapacity>;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/schools", variables.schoolId, "capacity"] });
        },
    });
}

export function useUpdateCapacity(schoolId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSchoolCapacity> }) => {
            const res = await apiRequest("PATCH", `/api/schools/${schoolId}/capacity/${id}`, data);
            return res.json() as Promise<SchoolCapacity>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "capacity"] });
        },
    });
}

export function useDeleteCapacity(schoolId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/schools/${schoolId}/capacity/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/schools", schoolId, "capacity"] });
        },
    });
}
