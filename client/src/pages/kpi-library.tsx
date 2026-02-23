import { useState } from "react";
import { useKpis, useKpiValues } from "@/hooks/use-kpis";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SparklineChart } from "@/components/kpi-widgets";
import {
  Search,
  BarChart3,
  Code2,
  Database,
  Layers,
  ArrowRight,
  Clock,
} from "lucide-react";

const CALC_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  sql: { label: "SQL", icon: <Database className="h-3 w-3" /> },
  js: { label: "JavaScript", icon: <Code2 className="h-3 w-3" /> },
  materialized: { label: "Materializado", icon: <Layers className="h-3 w-3" /> },
};

function KpiRowPreview({ kpiId }: { kpiId: string }) {
  const { data: values } = useKpiValues(kpiId, { limit: 12 });
  const latest = values?.[0];

  return (
    <div className="flex items-center gap-3">
      <div className="w-24">
        <SparklineChart values={values || []} height={32} />
      </div>
      {latest ? (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(latest.computedAt).toLocaleDateString("pt-BR")}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

export default function KpiLibraryPage() {
  const { user } = useAuth();
  const { data: kpis, isLoading } = useKpis();
  const [search, setSearch] = useState("");

  const isAdmin = user?.role === "admin";

  const filtered = (kpis || []).filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      k.name.toLowerCase().includes(q) ||
      k.key.toLowerCase().includes(q) ||
      (k.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-kpi-library-title"
          >
            Biblioteca de KPIs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores de performance comercial e financeira
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar KPI por nome ou chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-kpi-search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "Nenhum KPI encontrado para a busca"
                : "Nenhum KPI definido ainda"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filtered.length} indicador{filtered.length !== 1 ? "es" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Chave</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead className="hidden lg:table-cell">Tendência</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((kpi) => {
                  const ct = CALC_TYPE_LABELS[kpi.calcType] || {
                    label: kpi.calcType,
                    icon: null,
                  };
                  const config = kpi.config as Record<string, unknown>;
                  let formulaPreview = "—";
                  if (kpi.calcType === "sql" && config?.sql_template) {
                    const tpl = String(config.sql_template);
                    formulaPreview =
                      tpl.length > 60 ? tpl.slice(0, 60) + "…" : tpl;
                  } else if (kpi.calcType === "js" && config?.js_snippet) {
                    formulaPreview = `snippet: ${config.js_snippet}`;
                  }

                  return (
                    <TableRow
                      key={kpi.id}
                      data-testid={`row-kpi-${kpi.key}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{kpi.name}</p>
                          {kpi.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {kpi.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {kpi.key}
                        </code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {ct.icon}
                          {ct.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-[10px] text-muted-foreground line-clamp-1 max-w-[200px] block">
                          {formulaPreview}
                        </code>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <KpiRowPreview kpiId={kpi.id} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/kpis/${kpi.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            data-testid={`button-kpi-detail-${kpi.key}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
