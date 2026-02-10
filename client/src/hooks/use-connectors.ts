import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  Connector,
  ConnectorMapping,
  SyncRun,
  RawIngestFile,
  School,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useConnectors() {
  return useQuery<Connector[]>({
    queryKey: ["/api/connectors"],
  });
}

export function useConnector(id: string | undefined) {
  return useQuery<Connector>({
    queryKey: ["/api/connectors", id],
    enabled: !!id,
  });
}

export function useSchools() {
  return useQuery<School[]>({
    queryKey: ["/api/schools"],
  });
}

export function useConnectorMappings(connectorId: string | undefined) {
  return useQuery<ConnectorMapping[]>({
    queryKey: ["/api/connectors", connectorId, "mappings"],
    enabled: !!connectorId,
  });
}

export function useSyncRuns(connectorId: string | undefined) {
  return useQuery<SyncRun[]>({
    queryKey: ["/api/connectors", connectorId, "sync-runs"],
    enabled: !!connectorId,
  });
}

export function useRawIngestFiles(connectorId: string | undefined) {
  return useQuery<RawIngestFile[]>({
    queryKey: ["/api/connectors", connectorId, "files"],
    enabled: !!connectorId,
  });
}

export function useCreateConnector() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      config?: Record<string, unknown>;
      scheduleCron?: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/connectors", data);
      return res.json() as Promise<Connector>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "Conector criado", description: "O conector foi adicionado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export function useUpdateConnector(connectorId: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Partial<{
      name: string;
      type: string;
      config: Record<string, unknown>;
      scheduleCron: string | null;
      isActive: boolean;
    }>) => {
      const res = await apiRequest("PATCH", `/api/connectors/${connectorId}`, data);
      return res.json() as Promise<Connector>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connectors", connectorId] });
      toast({ title: "Conector atualizado", description: "As alterações foram salvas" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export function useDeleteConnector() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (connectorId: string) => {
      await apiRequest("DELETE", `/api/connectors/${connectorId}`);
      return connectorId;
    },
    onSuccess: (connectorId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      queryClient.removeQueries({ queryKey: ["/api/connectors", connectorId] });
      toast({ title: "Conector removido", description: "O conector foi excluído com sucesso" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export function useRunConnector(connectorId: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (options?: {
      batchSize?: number;
      maxPages?: number;
      dryRun?: boolean;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/connectors/${connectorId}/run`,
        options || {}
      );
      return res.json() as Promise<SyncRun>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/connectors", connectorId, "sync-runs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/connectors", connectorId, "files"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.recordsOut ?? 0} registros sincronizados`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro na sincronização", description: err.message });
    },
  });
}

export function useCreateMapping(connectorId: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      sourcePath: string;
      targetField: string;
      transform?: Record<string, unknown> | null;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/connectors/${connectorId}/mappings`,
        data
      );
      return res.json() as Promise<ConnectorMapping>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/connectors", connectorId, "mappings"],
      });
      toast({ title: "Mapeamento criado" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export function useUpdateMapping(connectorId: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      mappingId,
      data,
    }: {
      mappingId: string;
      data: Partial<{
        sourcePath: string;
        targetField: string;
        transform: Record<string, unknown> | null;
      }>;
    }) => {
      const res = await apiRequest("PATCH", `/api/connector-mappings/${mappingId}`, data);
      return res.json() as Promise<ConnectorMapping>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/connectors", connectorId, "mappings"],
      });
      toast({ title: "Mapeamento atualizado" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export function useDeleteMapping(connectorId: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest("DELETE", `/api/connector-mappings/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/connectors", connectorId, "mappings"],
      });
      toast({ title: "Mapeamento removido" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}
