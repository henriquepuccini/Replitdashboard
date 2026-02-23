import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  KpiDefinition,
  KpiValue,
  KpiGoal,
  KpiCalcRun,
  CalculationAudit,
  School,
} from "@shared/schema";

export function useKpis() {
  return useQuery<KpiDefinition[]>({
    queryKey: ["/api/kpis"],
  });
}

export function useKpi(id: string | undefined) {
  return useQuery<KpiDefinition>({
    queryKey: ["/api/kpis", id],
    enabled: !!id,
  });
}

export function useKpiValues(
  kpiId: string | undefined,
  filters?: { schoolId?: string | null; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters?.schoolId) params.set("school_id", filters.schoolId);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery<KpiValue[]>({
    queryKey: ["/api/kpis", kpiId, "values", qs],
    queryFn: async () => {
      const res = await fetch(
        `/api/kpis/${kpiId}/values${qs ? `?${qs}` : ""}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch KPI values");
      return res.json();
    },
    enabled: !!kpiId,
  });
}

export function useKpiGoals(
  kpiId: string | undefined,
  schoolId?: string | null
) {
  const params = new URLSearchParams();
  if (schoolId) params.set("school_id", schoolId);
  const qs = params.toString();

  return useQuery<KpiGoal[]>({
    queryKey: ["/api/kpis", kpiId, "goals", schoolId ?? "network"],
    queryFn: async () => {
      const res = await fetch(
        `/api/kpis/${kpiId}/goals${qs ? `?${qs}` : ""}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch KPI goals");
      return res.json();
    },
    enabled: !!kpiId,
  });
}

export function useKpiCalcRuns(kpiId: string | undefined, limit = 50) {
  return useQuery<KpiCalcRun[]>({
    queryKey: ["/api/kpis", kpiId, "calc-runs"],
    queryFn: async () => {
      const res = await fetch(
        `/api/kpis/${kpiId}/calc-runs?limit=${limit}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch calc runs");
      return res.json();
    },
    enabled: !!kpiId,
  });
}

export function useCalcRunAudit(runId: string | undefined) {
  return useQuery<CalculationAudit[]>({
    queryKey: ["/api/kpi-calc-runs", runId, "audit"],
    queryFn: async () => {
      const res = await fetch(`/api/kpi-calc-runs/${runId}/audit`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch audit");
      return res.json();
    },
    enabled: !!runId,
  });
}

export function useKpiSnippets() {
  return useQuery<{ key: string; description: string }[]>({
    queryKey: ["/api/kpi-snippets"],
  });
}

export function useSchools() {
  return useQuery<School[]>({
    queryKey: ["/api/schools"],
  });
}

export function useCreateKpiGoal(kpiId: string) {
  return useMutation({
    mutationFn: async (data: {
      schoolId?: string | null;
      periodStart: string;
      periodEnd: string;
      target: string;
    }) => {
      const res = await apiRequest("POST", `/api/kpis/${kpiId}/goals`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/kpis" &&
          query.queryKey[1] === kpiId &&
          query.queryKey[2] === "goals",
      });
    },
  });
}

export function useUpdateKpiGoal(kpiId: string) {
  return useMutation({
    mutationFn: async ({
      goalId,
      ...data
    }: {
      goalId: string;
      schoolId?: string | null;
      target?: string;
      periodStart?: string;
      periodEnd?: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/kpis/${kpiId}/goals/${goalId}`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/kpis" &&
          query.queryKey[1] === kpiId &&
          query.queryKey[2] === "goals",
      });
    },
  });
}

export function useDeleteKpiGoal(kpiId: string) {
  return useMutation({
    mutationFn: async (goalId: string) => {
      await apiRequest("DELETE", `/api/kpis/${kpiId}/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/kpis" &&
          query.queryKey[1] === kpiId &&
          query.queryKey[2] === "goals",
      });
    },
  });
}

export function useComputeKpi(kpiId: string) {
  return useMutation({
    mutationFn: async (data: {
      period_start: string;
      period_end: string;
      school_id?: string | null;
    }) => {
      const res = await apiRequest("POST", `/api/kpis/${kpiId}/compute`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpis", kpiId] });
    },
  });
}

export function useComputeKpiAll(kpiId: string) {
  return useMutation({
    mutationFn: async (data: {
      period_start: string;
      period_end: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/kpis/${kpiId}/compute-all`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpis", kpiId] });
    },
  });
}

export function exportKpiValuesToCsv(
  values: KpiValue[],
  kpiName: string,
  schoolsMap: Record<string, string>
) {
  const header = "Período Início,Período Fim,Escola,Valor,Computado Em\n";
  const rows = values.map((v) => {
    const school = v.schoolId ? schoolsMap[v.schoolId] || v.schoolId : "Rede";
    const computedAt = v.computedAt
      ? new Date(v.computedAt).toLocaleString("pt-BR")
      : "";
    return `${v.periodStart},${v.periodEnd},${school},${v.value},${computedAt}`;
  });
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kpi_${kpiName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
