import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchools } from "@/hooks/use-kpis";
import {
    useSchoolAggregates,
    useSchoolKpis,
    useUpdateSchoolKpiGoal,
    exportSchoolDashboard,
} from "@/hooks/use-school-dashboard";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useToast } from "@/hooks/use-toast";
import {
    subMonths,
    startOfMonth,
    endOfMonth,
    format,
    formatDistanceToNow,
    parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Download,
    Pencil,
    Clock,
    ExternalLink,
    Users,
    DollarSign,
    BarChart3,
    Loader2,
} from "lucide-react";
import type { KpiGoal, KpiDefinition } from "@shared/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRL = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PCT = (val: number) =>
    (val * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

const NUM = (val: number) =>
    val.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function formatMetricValue(key: string, val: number): string {
    if (key.includes("rate") || key.includes("percent") || key.includes("churn"))
        return PCT(val);
    if (key.includes("revenue") || key.includes("receita")) return BRL(val);
    return NUM(val);
}

function attainmentColor(pct: number): string {
    if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
}

function attainmentBg(pct: number): string {
    if (pct >= 100) return "bg-emerald-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-rose-500";
}

const PERIOD_OPTIONS = [
    { label: "Último mês", months: 1 },
    { label: "Últimos 3 meses", months: 3 },
    { label: "Últimos 6 meses", months: 6 },
    { label: "Últimos 12 meses", months: 12 },
];

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    delta?: number | null;
    description?: string;
}

function KpiCard({ title, value, icon, delta, description }: KpiCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight" data-testid={`kpi-card-value-${title}`}>
                    {value}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    {delta !== null && delta !== undefined ? (
                        <>
                            {delta > 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            ) : delta < 0 ? (
                                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span
                                className={`text-xs font-medium ${delta > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : delta < 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-muted-foreground"
                                    }`}
                            >
                                {delta > 0 ? "+" : ""}
                                {NUM(delta)}% vs período anterior
                            </span>
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground">{description}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Goal Edit Dialog
// ---------------------------------------------------------------------------

function GoalEditDialog({
    open,
    goal,
    kpiName,
    onClose,
    onSave,
    isPending,
}: {
    open: boolean;
    goal: KpiGoal;
    kpiName: string;
    onClose: () => void;
    onSave: (target: string) => void;
    isPending: boolean;
}) {
    const [target, setTarget] = useState(goal.target);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Meta — {kpiName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Período</Label>
                        <p className="text-sm text-muted-foreground">
                            {goal.periodStart} → {goal.periodEnd}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="goal-target">Valor alvo</Label>
                        <Input
                            id="goal-target"
                            type="number"
                            step="0.01"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            data-testid="input-edit-goal-target"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} data-testid="button-goal-edit-cancel">
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => onSave(target)}
                        disabled={isPending || !target}
                        data-testid="button-goal-edit-save"
                    >
                        {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SchoolDashboardPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const isDirector = user?.role === "director";
    const isFinance = user?.role === "finance";
    const isAdmin = user?.role === "admin";
    const isExec = user?.role === "exec";
    const canEditGoals = isAdmin || isDirector || isFinance;

    const { filters, setFilter, buildQueryString } = useDashboardFilters();

    // School selector
    const { data: schools, isLoading: schoolsLoading } = useSchools();
    const effectiveSchoolId = filters.schoolId || schools?.[0]?.id;

    // Period selector
    const periodMonths = filters.periodMonths;
    const periodFrom = useMemo(
        () => startOfMonth(subMonths(new Date(), periodMonths - 1)),
        [periodMonths]
    );
    const periodTo = useMemo(() => endOfMonth(new Date()), []);
    const periodLabel = `${format(periodFrom, "MMM/yy", { locale: ptBR })}–${format(
        periodTo,
        "MMM/yy",
        { locale: ptBR }
    )}`;

    // Data
    const { data: aggregates, isLoading: aggLoading } = useSchoolAggregates(
        effectiveSchoolId,
        { from: periodFrom, to: periodTo }
    );
    const { data: kpisData, isLoading: kpisLoading } = useSchoolKpis(
        effectiveSchoolId,
        { from: periodFrom, to: periodTo }
    );

    const updateGoal = useUpdateSchoolKpiGoal(effectiveSchoolId);
    const [editingGoal, setEditingGoal] = useState<KpiGoal | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Last freshness from most recent aggregate
    const latestAggregate = aggregates?.[aggregates.length - 1];
    const freshness = latestAggregate?.computedAt
        ? formatDistanceToNow(parseISO(latestAggregate.computedAt), {
            addSuffix: true,
            locale: ptBR,
        })
        : null;

    // KPI definitions map
    const defsMap = useMemo(() => {
        const m: Record<string, KpiDefinition> = {};
        kpisData?.definitions?.forEach((d) => (m[d.id] = d));
        return m;
    }, [kpisData?.definitions]);

    // Top KPI metrics from latest aggregate
    const latestMetrics = latestAggregate?.metrics ?? {};
    const conversion = latestMetrics["conversion_rate"] ?? null;
    const revenue = latestMetrics["revenue"] ?? null;
    const churn = latestMetrics["churn_rate"] ?? null;

    // Chart data: one entry per aggregate date
    const chartData = useMemo(() => {
        if (!aggregates?.length) return [];
        // Find matching goal for revenue KPI (first finance goal)
        const revenueGoal = kpisData?.goals?.find(
            (g) =>
                defsMap[g.kpiId]?.key?.includes("revenue") ||
                defsMap[g.kpiId]?.key?.includes("receita")
        );
        return aggregates.map((agg) => ({
            date: format(parseISO(agg.date), "MMM/yy", { locale: ptBR }),
            receita: agg.metrics["revenue"] ?? agg.metrics["receita"] ?? 0,
            meta: revenueGoal ? parseFloat(revenueGoal.target) : null,
        }));
    }, [aggregates, kpisData?.goals, defsMap]);

    // Goal attainment: join latest values with goals
    const goalAttainment = useMemo(() => {
        if (!kpisData?.goals?.length || !kpisData?.values?.length) return [];
        return kpisData.goals
            .filter((g) => g.schoolId === effectiveSchoolId)
            .map((goal) => {
                const def = defsMap[goal.kpiId];
                const latestValue = kpisData.values
                    .filter((v) => v.kpiId === goal.kpiId && v.schoolId === effectiveSchoolId)
                    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];
                const achieved = latestValue ? parseFloat(latestValue.value) : null;
                const target = parseFloat(goal.target);
                const pct = achieved !== null && target > 0 ? (achieved / target) * 100 : null;
                return { goal, def, achieved, target, pct };
            })
            .filter((r) => r.def != null);
    }, [kpisData, defsMap, effectiveSchoolId]);

    const isLoading = schoolsLoading || aggLoading || kpisLoading;

    const handleExport = async (fmt: "csv" | "pdf") => {
        if (!effectiveSchoolId) return;
        setIsExporting(true);
        try {
            await exportSchoolDashboard(effectiveSchoolId, periodLabel, fmt, aggregates);
            toast({ title: `Exportação ${fmt.toUpperCase()} iniciada` });
        } catch {
            toast({ title: "Erro ao exportar", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    const handleGoalSave = async (target: string) => {
        if (!editingGoal) return;
        try {
            await updateGoal.mutateAsync({
                kpiId: editingGoal.kpiId,
                goalId: editingGoal.id,
                target,
            });
            toast({ title: "Meta atualizada" });
            setEditingGoal(null);
        } catch (e) {
            toast({
                title: "Erro ao atualizar meta",
                description: e instanceof Error ? e.message : "Erro desconhecido",
                variant: "destructive",
            });
        }
    };

    const selectedSchoolName =
        schools?.find((s) => s.id === (effectiveSchoolId ?? ""))?.name ?? "—";

    return (
        <div className="space-y-6" data-testid="page-school-dashboard">
            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {(isAdmin || isExec) ? (
                        <>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/exec-dashboard">Dashboard Executivo</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{selectedSchoolName}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </>
                    ) : (
                        <BreadcrumbItem>
                            <BreadcrumbPage>Dashboard Escolar</BreadcrumbPage>
                        </BreadcrumbItem>
                    )}
                </BreadcrumbList>
            </Breadcrumb>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard Escolar</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        KPIs e metas por unidade
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* School selector */}
                    <Select
                        value={effectiveSchoolId ?? ""}
                        onValueChange={(val) => setFilter("school", val)}
                    >
                        <SelectTrigger className="w-[200px]" data-testid="select-school">
                            <SelectValue placeholder="Selecione a escola" />
                        </SelectTrigger>
                        <SelectContent>
                            {schools?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Period selector */}
                    <Select
                        value={String(periodMonths)}
                        onValueChange={(v) => setFilter("period", Number(v))}
                    >
                        <SelectTrigger className="w-[180px]" data-testid="select-period">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map((p) => (
                                <SelectItem key={p.months} value={String(p.months)}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Freshness indicator */}
                    {freshness && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span data-testid="text-freshness">Atualizado {freshness}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                Dados computados em{" "}
                                {latestAggregate?.computedAt
                                    ? new Date(latestAggregate.computedAt).toLocaleString("pt-BR")
                                    : "—"}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Export */}
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExport("csv")}
                            disabled={isExporting || !effectiveSchoolId}
                            data-testid="button-export-csv"
                        >
                            {isExporting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Download className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1.5 hidden sm:inline">CSV</span>
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExport("pdf")}
                            disabled={isExporting || !effectiveSchoolId}
                            data-testid="button-export-pdf"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="ml-1.5 hidden sm:inline">PDF</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="revenue" data-testid="tab-revenue">Receita</TabsTrigger>
                    <TabsTrigger value="goals" data-testid="tab-goals">Metas</TabsTrigger>
                </TabsList>

                {/* ── Visão Geral ──────────────────────────────────────────── */}
                <TabsContent value="overview" className="space-y-6 mt-4">

                    {/* KPI Cards */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <KpiCard
                                title="Taxa de Conversão"
                                value={conversion !== null ? PCT(conversion) : "—"}
                                icon={<BarChart3 className="h-4 w-4" />}
                                description={conversion === null ? "Sem dados" : undefined}
                            />
                            <KpiCard
                                title="Receita"
                                value={revenue !== null ? BRL(revenue) : "—"}
                                icon={<DollarSign className="h-4 w-4" />}
                                description={revenue === null ? "Sem dados" : undefined}
                            />
                            <KpiCard
                                title="Churn"
                                value={churn !== null ? PCT(churn) : "—"}
                                icon={<Users className="h-4 w-4" />}
                                description={churn === null ? "Sem dados" : undefined}
                            />
                        </div>
                    )}

                    {/* Goal Attainment */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Atingimento de Metas</CardTitle>
                            <CardDescription>{selectedSchoolName} · {periodLabel}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : !goalAttainment.length ? (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                    Nenhuma meta configurada para esta escola e período
                                </p>
                            ) : (
                                <div className="space-y-5">
                                    {goalAttainment.map(({ goal, def, achieved, target, pct }) => (
                                        <div key={goal.id} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{def?.name ?? goal.kpiId}</span>
                                                <span className={`font-semibold ${pct !== null ? attainmentColor(pct) : "text-muted-foreground"}`}>
                                                    {pct !== null ? `${Math.round(pct)}%` : "—"}
                                                </span>
                                            </div>
                                            <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={`absolute h-full rounded-full transition-all duration-500 ${pct !== null ? attainmentBg(pct) : "bg-muted-foreground/20"}`}
                                                    style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>
                                                    Realizado:{" "}
                                                    {achieved !== null
                                                        ? formatMetricValue(def?.key ?? "", achieved)
                                                        : "—"}
                                                </span>
                                                <span>Meta: {formatMetricValue(def?.key ?? "", target)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Drilldown CTAs */}
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" asChild data-testid="link-drilldown-leads">
                            <Link href={`/leads${buildQueryString({ school: effectiveSchoolId })}`}>
                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                Ver Leads
                            </Link>
                        </Button>
                        <Button variant="outline" asChild data-testid="link-drilldown-pipeline">
                            <Link href={`/pipeline${buildQueryString({ school: effectiveSchoolId })}`}>
                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                Ver Pipeline
                            </Link>
                        </Button>
                    </div>
                </TabsContent>

                {/* ── Receita ──────────────────────────────────────────────── */}
                <TabsContent value="revenue" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Receita vs Meta</CardTitle>
                            <CardDescription>
                                {selectedSchoolName} · {periodLabel}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-64 w-full" />
                            ) : !chartData.length ? (
                                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                                    Nenhum dado de receita disponível para o período
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 12 }}
                                            className="text-muted-foreground"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) => BRL(v).replace("R$\u00a0", "R$")}
                                            width={80}
                                            className="text-muted-foreground"
                                        />
                                        <RechartsTooltip
                                            formatter={(value: number, name: string) => [
                                                BRL(value),
                                                name === "receita" ? "Receita" : "Meta",
                                            ]}
                                            contentStyle={{ fontSize: 12 }}
                                        />
                                        <Legend
                                            formatter={(v) => (v === "receita" ? "Receita" : "Meta")}
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="receita"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary) / 0.15)"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        {chartData.some((d) => d.meta !== null) && (
                                            <Line
                                                type="monotone"
                                                dataKey="meta"
                                                stroke="hsl(var(--destructive))"
                                                strokeWidth={1.5}
                                                strokeDasharray="5 3"
                                                dot={false}
                                            />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Metas ────────────────────────────────────────────────── */}
                <TabsContent value="goals" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Metas por KPI</CardTitle>
                            <CardDescription>
                                {selectedSchoolName} · {periodLabel}
                                {!canEditGoals && (
                                    <span className="ml-2 text-xs">(somente leitura)</span>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-2 p-4">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : !goalAttainment.length ? (
                                <p className="text-sm text-muted-foreground text-center py-10">
                                    Nenhuma meta para esta escola e período
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>KPI</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Período</TableHead>
                                            <TableHead className="text-right">Meta</TableHead>
                                            <TableHead className="text-right">Realizado</TableHead>
                                            <TableHead className="text-right">%</TableHead>
                                            {canEditGoals && <TableHead className="w-12" />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {goalAttainment.map(({ goal, def, achieved, target, pct }) => {
                                            // Finance: only show edit for finance-category KPIs
                                            const canEdit =
                                                isAdmin ||
                                                isDirector ||
                                                (isFinance && (def as any)?.category === "finance");
                                            return (
                                                <TableRow
                                                    key={goal.id}
                                                    data-testid={`row-goal-${goal.id}`}
                                                >
                                                    <TableCell className="font-medium text-sm">
                                                        {def?.name ?? goal.kpiId}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(def as any)?.category && (
                                                            <Badge variant="secondary" className="text-[11px]">
                                                                {(def as any).category}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {goal.periodStart} → {goal.periodEnd}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatMetricValue(def?.key ?? "", target)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {achieved !== null
                                                            ? formatMetricValue(def?.key ?? "", achieved)
                                                            : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-semibold ${pct !== null ? attainmentColor(pct) : "text-muted-foreground"}`}>
                                                        {pct !== null ? `${Math.round(pct)}%` : "—"}
                                                    </TableCell>
                                                    {canEditGoals && (
                                                        <TableCell>
                                                            {canEdit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => setEditingGoal(goal)}
                                                                    data-testid={`button-edit-goal-${goal.id}`}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
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

            {/* ── Goal edit dialog ─────────────────────────────────────── */}
            {editingGoal && (
                <GoalEditDialog
                    open={!!editingGoal}
                    goal={editingGoal}
                    kpiName={defsMap[editingGoal.kpiId]?.name ?? editingGoal.kpiId}
                    onClose={() => setEditingGoal(null)}
                    onSave={handleGoalSave}
                    isPending={updateGoal.isPending}
                />
            )}
        </div>
    );
}
