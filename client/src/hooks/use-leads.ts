import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Lead } from "@shared/schema";

export interface LeadFilters {
  stage?: string;
  status?: string;
  seller_id?: string;
  school_id?: string;
  source?: string;
  search?: string;
  period_start?: string;
  period_end?: string;
  page?: number;
  limit?: number;
}

export interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildLeadsUrl(filters: LeadFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return `/api/leads${qs ? `?${qs}` : ""}`;
}

export function useLeads(filters: LeadFilters = {}) {
  const url = buildLeadsUrl(filters);

  return useQuery<LeadsResponse>({
    queryKey: ["/api/leads", filters],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery<Lead>({
    queryKey: ["/api/leads", id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!id,
  });
}

interface UpdateLeadInput {
  id: string;
  stage?: string;
  status?: string;
  lastInteraction?: string;
  sellerId?: string | null;
  schoolId?: string | null;
  payload?: Record<string, unknown>;
}

export function useUpdateLead() {
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLeadInput) => {
      const res = await apiRequest("PATCH", `/api/leads/${id}`, data);
      return res.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "/api/leads",
      });

      const previousQueries: { queryKey: readonly unknown[]; data: unknown }[] = [];
      queryClient.getQueriesData({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "/api/leads",
      }).forEach(([queryKey, data]) => {
        previousQueries.push({ queryKey, data });
      });

      queryClient.setQueriesData(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === "/api/leads",
        },
        (old: unknown) => {
          if (!old) return old;
          if (typeof old === "object" && old !== null && "data" in old) {
            const resp = old as LeadsResponse;
            return {
              ...resp,
              data: resp.data.map((l) =>
                l.id === variables.id ? { ...l, ...variables } : l
              ),
            };
          }
          if (typeof old === "object" && old !== null && "id" in old) {
            const lead = old as Lead;
            if (lead.id === variables.id) return { ...lead, ...variables };
          }
          return old;
        }
      );

      return { previousQueries };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousQueries) {
        for (const { queryKey, data } of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "/api/leads",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/agg"] });
    },
  });
}

export function canEditLead(userRole: string | undefined, userId: string | undefined, lead: Lead | undefined): boolean {
  if (!userRole || !lead) return false;
  if (userRole === "admin" || userRole === "ops") return true;
  if (userRole === "seller" && lead.sellerId === userId) return true;
  return false;
}

export const PIPELINE_STAGES = [
  { key: "new", label: "Novo", color: "bg-blue-500" },
  { key: "contacted", label: "Contatado", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualificado", color: "bg-orange-500" },
  { key: "proposal", label: "Proposta", color: "bg-purple-500" },
  { key: "negotiation", label: "Negociação", color: "bg-indigo-500" },
  { key: "won", label: "Ganho", color: "bg-green-500" },
  { key: "lost", label: "Perdido", color: "bg-red-500" },
] as const;

export function getStageLabel(stage: string): string {
  return PIPELINE_STAGES.find((s) => s.key === stage)?.label || stage;
}

export function getStageColor(stage: string): string {
  return PIPELINE_STAGES.find((s) => s.key === stage)?.color || "bg-gray-500";
}
