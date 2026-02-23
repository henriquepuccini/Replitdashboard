import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useKpi,
  useKpiValues,
  useKpiGoals,
  useKpiCalcRuns,
  useCalcRunAudit,
  useSchools,
  useComputeKpi,
  useComputeKpiAll,
  exportKpiValuesToCsv,
} from "@/hooks/use-kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiTimeseriesChart, KpiCard, GoalVariance } from "@/components/kpi-widgets";
import {
  ArrowLeft,
  Play,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  success: { label: "Sucesso", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Falha", icon: <XCircle className="h-3 w-3" />, color: "text-red-600 dark:text-red-400" },
  running: { label: "Executando", icon: <Loader2 className="h-3 w-3 animate-spin" />, color: "text-blue-600" },
  pending: { label: "Pendente", icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground" },
};

function AuditDialog({ runId, open, onClose }: { runId: string; open: boolean; onClose: () => void }) {
  const { data: audits, isLoading } = useCalcRunAudit(open ? runId : undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Auditoria do Cálculo</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !audits?.length ? (
          <p className="text-sm text-muted-foreground">Sem registros de auditoria</p>
        ) : (
          audits.map((a) => (
            <div key={a.id} className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Entrada</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48" data-testid="text-audit-input">
                  {JSON.stringify(a.inputSnapshot, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Resultado</p>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48" data-testid="text-audit-result">
                  {JSON.stringify(a.resultSnapshot, null, 2)}
                </pre>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {new Date(a.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function KpiDetailPage() {
  const [, params] = useRoute("/kpis/:id");
  const kpiId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isOps = user?.role === "ops";
  const canCompute = isAdmin || isOps;

  const { data: kpi, isLoading: kpiLoading } = useKpi(kpiId);
  const { data: schools } = useSchools();

  const [schoolFilter, setSchoolFilter] = useState<string>("network");
  const effectiveSchoolId = schoolFilter === "network" ? undefined : schoolFilter;

  const { data: values, isLoading: valuesLoading } = useKpiValues(kpiId, {
    schoolId: effectiveSchoolId,
    limit: 50,
  });
  const { data: goals } = useKpiGoals(kpiId, effectiveSchoolId);
  const { data: calcRuns } = useKpiCalcRuns(kpiId);

  const computeMutation = useComputeKpi(kpiId || "");
  const computeAllMutation = useComputeKpiAll(kpiId || "");

  const [auditRunId, setAuditRunId] = useState<string | null>(null);

  const schoolsMap: Record<string, string> = {};
  schools?.forEach((s) => {
    schoolsMap[s.id] = s.name;
  });

  const latest = values?.[0];
  const previous = values?.[1];
  const currentGoal = goals?.[0] || null;

  const handleCompute = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10);

    try {
      await computeMutation.mutateAsync({
        period_start: start,
        period_end: end,
        school_id: effectiveSchoolId || null,
      });
      toast({ title: "Cálculo executado com sucesso" });
    } catch (e) {
      toast({
        title: "Erro ao calcular",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleComputeAll = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10);

    try {
      await computeAllMutation.mutateAsync({
        period_start: start,
        period_end: end,
      });
      toast({ title: "Cálculo executado para todas as escolas" });
    } catch (e) {
      toast({
        title: "Erro ao calcular",
        description: e instanceof Error ? e.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (values && kpi) {
      exportKpiValuesToCsv(values, kpi.name, schoolsMap);
    }
  };

  if (kpiLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">KPI não encontrado</p>
        <Link href="/kpis">
          <Button variant="ghost" className="mt-2" data-testid="link-back-kpis">
            Voltar para Biblioteca
          </Button>
        </Link>
      </div>
    );
  }

  const config = kpi.config as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/kpis">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-kpis">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              data-testid="text-kpi-detail-title"
            >
              {kpi.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {kpi.key}
              </code>
              <Badge variant="outline" className="text-[10px]">
                {kpi.calcType.toUpperCase()}
              </Badge>
              {!kpi.isActive && (
                <Badge variant="destructive" className="text-[10px]">
                  Inativo
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCompute && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleComputeAll}
                disabled={computeAllMutation.isPending}
                data-testid="button-compute-all"
              >
                {computeAllMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Calcular Todas
              </Button>
              <Button
                size="sm"
                onClick={handleCompute}
                disabled={computeMutation.isPending}
                data-testid="button-compute"
              >
                {computeMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Calcular
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={!values?.length}
            data-testid="button-export-csv"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      {kpi.description && (
        <p className="text-sm text-muted-foreground">{kpi.description}</p>
      )}

      <div className="flex items-center gap-3">
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-school-filter">
            <SelectValue placeholder="Filtrar por escola" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="network">Rede (todas)</SelectItem>
            {schools?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Valor Atual"
          value={latest?.value ?? null}
          previousValue={previous?.value ?? null}
          lastComputedAt={latest?.computedAt ? String(latest.computedAt) : null}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meta Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentGoal ? (
              <div>
                <p className="text-2xl font-bold" data-testid="text-current-goal">
                  {parseFloat(currentGoal.target).toLocaleString("pt-BR")}
                </p>
                <GoalVariance
                  currentValue={latest ? parseFloat(latest.value) : null}
                  goal={currentGoal}
                />
              </div>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Configuração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-[10px] text-muted-foreground block max-h-16 overflow-auto whitespace-pre-wrap">
              {kpi.calcType === "sql"
                ? String(config?.sql_template || "—")
                : kpi.calcType === "js"
                  ? `snippet: ${config?.js_snippet || "—"}`
                  : JSON.stringify(config, null, 2)}
            </code>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList data-testid="tabs-kpi-detail">
          <TabsTrigger value="chart" data-testid="tab-chart">Gráfico</TabsTrigger>
          <TabsTrigger value="values" data-testid="tab-values">Valores</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Histórico de Cálculos</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução Temporal</CardTitle>
            </CardHeader>
            <CardContent>
              {valuesLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <KpiTimeseriesChart values={values || []} goals={goals || []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="values">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Valores Computados</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={!values?.length}
                data-testid="button-export-csv-table"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {valuesLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !values?.length ? (
                <p className="text-sm text-muted-foreground p-4">
                  Nenhum valor computado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Escola</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Computado Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((v) => (
                      <TableRow key={v.id} data-testid={`row-kpi-value-${v.id}`}>
                        <TableCell className="text-sm">
                          {v.periodStart} → {v.periodEnd}
                        </TableCell>
                        <TableCell className="text-sm">
                          {v.schoolId
                            ? schoolsMap[v.schoolId] || v.schoolId
                            : "Rede"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {parseFloat(v.value).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(v.computedAt).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execuções de Cálculo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!calcRuns?.length ? (
                <p className="text-sm text-muted-foreground p-4">
                  Nenhuma execução registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcRuns.map((run) => {
                      const st = STATUS_LABELS[run.status] || STATUS_LABELS.pending;
                      return (
                        <TableRow key={run.id} data-testid={`row-calc-run-${run.id}`}>
                          <TableCell>
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${st.color}`}>
                              {st.icon}
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{run.version || "—"}</code>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(run.startedAt).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {run.finishedAt
                              ? new Date(String(run.finishedAt)).toLocaleString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setAuditRunId(run.id)}
                              data-testid={`button-audit-${run.id}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {auditRunId && (
        <AuditDialog
          runId={auditRunId}
          open={!!auditRunId}
          onClose={() => setAuditRunId(null)}
        />
      )}
    </div>
  );
}
