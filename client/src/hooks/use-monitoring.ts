import { useQuery, useMutation } from "@tanstack/react-query";
import type { ConnectorMetric, ConnectorSla, IntegrationAlert, InsertConnectorSla, InsertIntegrationAlert } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useConnectorMetrics(connectorId: string, limit: number = 100) {
    return useQuery<ConnectorMetric[]>({
        queryKey: [`/api/monitoring/metrics/${connectorId}?limit=${limit}`],
        enabled: !!connectorId,
    });
}

export function useConnectorSlas() {
    return useQuery<ConnectorSla[]>({
        queryKey: ["/api/monitoring/slas"],
    });
}

export function useUpdateConnectorSla() {
    const { toast } = useToast();
    return useMutation({
        mutationFn: async (data: InsertConnectorSla) => {
            const res = await apiRequest("PATCH", `/api/monitoring/slas/${data.connectorId}`, data);
            return res.json();
        },
        onSuccess: (updated: ConnectorSla) => {
            queryClient.invalidateQueries({ queryKey: ["/api/monitoring/slas"] });
            toast({
                title: "SLA Updated",
                description: "Connector SLA configuration has been saved.",
            });
        },
        onError: (err: Error) => {
            toast({
                title: "Failed to update SLA",
                description: err.message,
                variant: "destructive",
            });
        }
    });
}

export function useIntegrationAlerts(limit: number = 200) {
    return useQuery<IntegrationAlert[]>({
        queryKey: [`/api/monitoring/alerts?limit=${limit}`],
        // Polling every 30s to keep alerts fresh
        refetchInterval: 30000,
    });
}

export function useUpdateIntegrationAlert() {
    const { toast } = useToast();
    return useMutation({
        mutationFn: async ({ id, ...data }: Partial<InsertIntegrationAlert> & { id: string }) => {
            const res = await apiRequest("PATCH", `/api/monitoring/alerts/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            // Invalidate alerts starting with /api/monitoring/alerts
            queryClient.invalidateQueries({ queryKey: ["/api/monitoring/alerts"] });
            toast({
                title: "Alert Updated",
                description: "Alert state has been successfully updated.",
            });
        },
        onError: (err: Error) => {
            toast({
                title: "Failed to update alert",
                description: err.message,
                variant: "destructive",
            });
        }
    });
}
