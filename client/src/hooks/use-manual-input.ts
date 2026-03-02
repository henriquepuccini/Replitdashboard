import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface ManualInput {
    id: string;
    schoolId: string | null;
    dataReferencia: string;
    chaveMetrica: string;
    valor: string;
    notas: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ManualInputFilters {
    schoolId?: string;
    chaveMetrica?: string;
    startDate?: string;
    endDate?: string;
}

export interface UpsertManualInputPayload {
    schoolId?: string | null;
    dataReferencia: string;
    chaveMetrica: string;
    valor: number;
    notas?: string | null;
}

async function fetchManualInputs(filters?: ManualInputFilters): Promise<ManualInput[]> {
    const params = new URLSearchParams();
    if (filters?.schoolId) params.set("schoolId", filters.schoolId);
    if (filters?.chaveMetrica) params.set("chaveMetrica", filters.chaveMetrica);
    if (filters?.startDate) params.set("startDate", filters.startDate);
    if (filters?.endDate) params.set("endDate", filters.endDate);
    const qs = params.toString();
    const res = await fetch(`/api/manual-data${qs ? `?${qs}` : ""}`, {
        credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export function useManualInputs(filters?: ManualInputFilters) {
    return useQuery<ManualInput[]>({
        queryKey: ["manual-inputs", filters],
        queryFn: () => fetchManualInputs(filters),
    });
}

export function useUpsertManualInput() {
    const qc = useQueryClient();
    const { toast } = useToast();

    return useMutation<ManualInput, Error, UpsertManualInputPayload>({
        mutationFn: async (payload) => {
            const res = await fetch("/api/manual-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: "Erro ao salvar" }));
                throw new Error(err.message || "Erro ao salvar");
            }
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["manual-inputs"] });
            toast({ title: "Dado salvo com sucesso" });
        },
        onError: (err) => {
            toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
        },
    });
}

export function useDeleteManualInput() {
    const qc = useQueryClient();
    const { toast } = useToast();

    return useMutation<void, Error, string>({
        mutationFn: async (id) => {
            const res = await fetch(`/api/manual-data/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok && res.status !== 204) {
                const err = await res.json().catch(() => ({ message: "Erro ao excluir" }));
                throw new Error(err.message || "Erro ao excluir");
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["manual-inputs"] });
            toast({ title: "Dado excluído" });
        },
        onError: (err) => {
            toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
        },
    });
}
