import { useAuth } from "@/hooks/use-auth";
import { useKpis, useKpiValues } from "@/hooks/use-kpis";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, SparklineChart } from "@/components/kpi-widgets";
import { BarChart3 } from "lucide-react";
import type { KpiDefinition, KpiValue } from "@shared/schema";

const KPI_ICONS: Record<string, string> = {
  new_enrollments: "users",
  total_revenue: "trending-up",
  new_leads: "user-plus",
  lead_conversion_rate: "bar-chart",
  avg_ticket: "dollar-sign",
};

const KPI_FORMAT: Record<string, "number" | "currency" | "percent"> = {
  total_revenue: "currency",
  avg_ticket: "currency",
  lead_conversion_rate: "percent",
};

function DashboardKpiCard({ kpi }: { kpi: KpiDefinition }) {
  const { data: values, isLoading } = useKpiValues(kpi.id, { limit: 12 });
  const [, setLocation] = useLocation();

  const latest = values?.[0];
  const previous = values?.[1];
  const format = KPI_FORMAT[kpi.key] || "number";

  if (isLoading) {
    return <Skeleton className="h-[140px]" />;
  }

  return (
    <div className="space-y-1">
      <KpiCard
        title={kpi.name}
        value={latest?.value ?? null}
        previousValue={previous?.value ?? null}
        format={format}
        lastComputedAt={latest?.computedAt ? String(latest.computedAt) : null}
        onClick={() => setLocation(`/kpis/${kpi.id}`)}
      />
      {values && values.length > 1 && (
        <div className="px-2">
          <SparklineChart values={values} height={36} />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: kpis, isLoading } = useKpis();

  const activeKpis = (kpis || []).filter((k) => k.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          data-testid="text-dashboard-title"
        >
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo, {user?.fullName || user?.email}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      ) : activeKpis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum KPI configurado ainda. Configure indicadores na Biblioteca de KPIs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeKpis.map((kpi) => (
            <DashboardKpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Comercial</CardTitle>
        </CardHeader>
        <CardContent>
          {activeKpis.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center space-y-2">
                <BarChart3 className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">
                  Os gráficos de performance serão exibidos após configurar os KPIs
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Clique em um KPI acima para ver detalhes e gráficos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
