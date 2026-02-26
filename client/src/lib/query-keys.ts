/**
 * Centralized Query Keys Factory
 * 
 * Consistent query keys are essential for React Query cache management.
 * Use these factories instead of hardcoding string arrays in components.
 */

export const queryKeys = {
    auth: {
        me: () => ["/api/auth/me"] as const,
        syncLogs: (userId: string) => ["/api/auth/sync-logs", userId] as const,
    },
    users: {
        all: () => ["/api/users"] as const,
        detail: (id: string) => ["/api/users", id] as const,
    },
    schools: {
        all: () => ["/api/schools"] as const,
        detail: (id: string) => ["/api/schools", id] as const,
    },
    connectors: {
        all: () => ["/api/connectors"] as const,
        detail: (id: string) => ["/api/connectors", id] as const,
        mappings: (id: string) => ["/api/connectors", id, "mappings"] as const,
        syncRuns: (id: string) => ["/api/connectors", id, "sync-runs"] as const,
        files: (id: string) => ["/api/connectors", id, "files"] as const,
    },
    leads: {
        all: () => ["/api/leads"] as const,
        detail: (id: string) => ["/api/leads", id] as const,
    },
    monitoring: {
        metrics: (connectorId: string, limit?: number) => [`/api/monitoring/metrics/${connectorId}?limit=${limit || 100}`] as const,
        slas: () => ["/api/monitoring/slas"] as const,
        alerts: (limit?: number) => [`/api/monitoring/alerts?limit=${limit || 200}`] as const,
    },
    churn: {
        rules: () => ["/api/churn/rules"] as const,
        events: (filters?: Record<string, any>) => ["/api/churn/events", filters] as const,
        runs: (ruleId: string) => ["/api/churn/runs", ruleId] as const,
    },
    kpis: {
        definitions: (activeOnly?: boolean) => ["/api/kpis", { activeOnly }] as const,
        detail: (id: string) => ["/api/kpis", id] as const,
        values: (kpiId: string, schoolId?: string | null) => ["/api/kpis", kpiId, "values", { schoolId }] as const,
        goals: (kpiId: string, schoolId?: string | null) => ["/api/kpis", kpiId, "goals", { schoolId }] as const,
        runs: (kpiId: string) => ["/api/kpis", kpiId, "runs"] as const,
    },
    reports: {
        scheduled: () => ["/api/reports/scheduled"] as const,
        exports: () => ["/api/reports/exports"] as const,
    },
    integrations: {
        health: () => ["/api/monitoring/health"] as const,
    }
} as const;
