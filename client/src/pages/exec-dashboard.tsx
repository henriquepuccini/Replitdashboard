import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchools } from "@/hooks/use-kpis";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import {
    useNetworkAggregates,
    useSchoolComparison,
    exportExecDashboard,
} from "@/hooks/use-exec-dashboard";
import { SchoolComparisonHeatmap } from "@/components/school-comparison-heatmap";
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
} from "recharts";
import {
    TrendingUp,
    TrendingDown,
    Download,
    Clock,
    ExternalLink,
    Globe,
    BarChart3,
    Trophy,
    Loader2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BRL = (v: number) =>
    v.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    });

const PCT = (v: number) =>
    (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

const NUM = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function formatMetric(key: string, val: number): string {
    if (key.includes("rate") || key.includes("percent") || key.includes("churn"))
        return PCT(val);
    if (key.includes("revenue") || key.includes("receita")) return BRL(val);
    return NUM(val);
}

const PERIOD_OPTIONS = [
    { label: "Último mês", months: 1 },
    { label: "Últimos 3 meses", months: 3 },
    { label: "Últimos 6 meses", months: 6 },
    { label: "Últimos 12 meses", months: 12 },
];

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
    label,
    value,
    delta,
    icon,
}: {
    label: string;
    value: string;
    delta?: number | null;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                {delta !== null && delta !== undefined && (
                    <p
                        className={`flex items-center gap-1 text-xs mt-1 ${delta >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                            }`}
                    >
                        {delta >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {delta >= 0 ? "+" : ""}
                        {NUM(delta)}% vs período anterior
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Variance badge
// ---------------------------------------------------------------------------

function VarianceBadge({ value }: { value: number | null }) {
    if (value === null) return <span className="text-muted-foreground">—</span>;
    const positive = value >= 0;
    return (
        <Badge
            variant="secondary"
            className={
                positive
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            }
        >
            {positive ? "+" : ""}
            {value.toFixed(1)}%
        </Badge>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ExecDashboardPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const { filters, setFilter, buildQueryString } = useDashboardFilters();

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

    // Metric selector (for comparison table and heatmap focus)
    const focusMetric = filters.metric;

    // Pagination
    const [page, setPage] = useState(0);

    // Data
    const { data: networkAggs, isLoading: aggLoading } = useNetworkAggregates({
        from: periodFrom,
        to: periodTo,
    });
    const { data: comparisons, isLoading: compLoading } = useSchoolComparison({
        from: periodFrom,
        to: periodTo,
        metricKey: focusMetric,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
    });
    // Fire second query for heatmap — no metric filter, full set
    const { data: allComparisons, isLoading: heatmapLoading } = useSchoolComparison({
        from: periodFrom,
        to: periodTo,
    });

    // Schools map for display names
    const { data: schools } = useSchools();
    const schoolNames = useMemo(() => {
        const m: Record<string, string> = {};
        schools?.forEach((s) => (m[s.id] = s.name));
        return m;
    }, [schools]);

    // Latest network aggregate for KPI cards
    const latest = networkAggs?.[(networkAggs?.length ?? 0) - 1];
    const prev = (networkAggs?.length ?? 0) > 1 ? networkAggs![networkAggs!.length - 2] : undefined;

    // Freshness
    const freshness = latest?.computedAt
        ? formatDistanceToNow(parseISO(latest.computedAt), {
            addSuffix: true,
            locale: ptBR,
        })
        : null;

    // Chart data: map each aggregate row to {date, revenue, conversion_rate, ...}
    const chartData = useMemo(() => {
        return (networkAggs ?? []).map((agg) => ({
            date: format(parseISO(agg.date), "MMM/yy", { locale: ptBR }),
            receita: agg.metrics["revenue"] ?? agg.metrics["receita"] ?? 0,
            conversao: agg.metrics["conversion_rate"]
                ? +(agg.metrics["conversion_rate"] * 100).toFixed(2)
                : 0,
        }));
    }, [networkAggs]);

    // Distinct metric keys across all comparisons for the selector
    const availableMetrics = useMemo(
        () => Array.from(new Set(allComparisons?.map((r) => r.metricKey) ?? [])).sort(),
        [allComparisons]
    );

    // KPI delta helper
    function delta(key: string): number | null {
        if (!latest || !prev) return null;
        const cur = latest.metrics[key];
        const pre = prev.metrics[key];
        if (!cur || !pre || pre === 0) return null;
        return +((cur / pre - 1) * 100).toFixed(1);
    }

    // Export
    const [isExporting, setIsExporting] = useState(false);
    const handleExport = async (fmt: "csv" | "pdf") => {
        setIsExporting(true);
        try {
            await exportExecDashboard(
                { from: periodFrom, to: periodTo, metricKey: focusMetric },
                fmt,
                networkAggs
            );
            toast({ title: `Exportação ${fmt.toUpperCase()} concluída` });
        } catch {
            toast({ title: "Erro ao exportar", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    const isLoading = aggLoading || compLoading;

    return (
        <div className="space-y-6" data-testid="page-exec-dashboard">
            {/* ── Breadcrumb ─────────────────────────────────────────────── */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Dashboard Executivo</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
                    <p className="text-sm text-muted-foreground">
                        Visão consolidada da rede · {user?.role === "admin" ? "Admin" : "Exec"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period */}
                    <Select
                        value={String(periodMonths)}
                        onValueChange={(v) => {
                            setFilter("period", Number(v));
                            setPage(0);
                        }}
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

                    {/* Freshness */}
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
                                {latest?.computedAt
                                    ? new Date(latest.computedAt).toLocaleString("pt-BR")
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
                            disabled={isExporting}
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
                            disabled={isExporting}
                            data-testid="button-export-pdf"
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="ml-1.5 hidden sm:inline">PDF</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <Tabs defaultValue="network">
                <TabsList>
                    <TabsTrigger value="network" data-testid="tab-network">Rede</TabsTrigger>
                    <TabsTrigger value="comparison" data-testid="tab-comparison">Comparação</TabsTrigger>
                    <TabsTrigger value="heatmap" data-testid="tab-heatmap">Heatmap</TabsTrigger>
                </TabsList>

                {/* ── Rede ─────────────────────────────────────────────────── */}
                <TabsContent value="network" className="space-y-6 mt-4">
                    {/* Network KPI Cards */}
                    {aggLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <KpiCard
                                label="Receita da Rede"
                                value={
                                    latest?.metrics["revenue"]
                                        ? BRL(latest.metrics["revenue"])
                                        : "—"
                                }
                                delta={delta("revenue")}
                                icon={<Globe className="h-4 w-4" />}
                            />
                            <KpiCard
                                label="Conversão Média"
                                value={
                                    latest?.metrics["conversion_rate"]
                                        ? PCT(latest.metrics["conversion_rate"])
                                        : "—"
                                }
                                delta={delta("conversion_rate")}
                                icon={<BarChart3 className="h-4 w-4" />}
                            />
                            <KpiCard
                                label="Churn Médio"
                                value={
                                    latest?.metrics["churn_rate"]
                                        ? PCT(latest.metrics["churn_rate"])
                                        : "—"
                                }
                                delta={delta("churn_rate")}
                                icon={<Trophy className="h-4 w-4" />}
                            />
                        </div>
                    )}

                    {/* Network Time Series */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Evolução da Rede</CardTitle>
                            <CardDescription>{periodLabel}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {aggLoading ? (
                                <Skeleton className="h-64 w-full" />
                            ) : !chartData.length ? (
                                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                                    Nenhum dado de agregação disponível
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <ComposedChart
                                        data={chartData}
                                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            className="stroke-muted/40"
                                        />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis
                                            yAxisId="rev"
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) => BRL(v).replace("R$\u00a0", "R$")}
                                            width={80}
                                        />
                                        <YAxis
                                            yAxisId="pct"
                                            orientation="right"
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) => `${v}%`}
                                            width={40}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ fontSize: 12 }}
                                            formatter={(value: number, name: string) => {
                                                if (name === "receita") return [BRL(value), "Receita"];
                                                return [`${value}%`, "Conversão"];
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: 12 }}
                                            formatter={(v) => (v === "receita" ? "Receita" : "Conversão")}
                                        />
                                        <Area
                                            yAxisId="rev"
                                            type="monotone"
                                            dataKey="receita"
                                            stroke="hsl(var(--primary))"
                                            fill="hsl(var(--primary) / 0.15)"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Area
                                            yAxisId="pct"
                                            type="monotone"
                                            dataKey="conversao"
                                            stroke="hsl(220, 70%, 60%)"
                                            fill="hsl(220, 70%, 60%, 0.1)"
                                            strokeWidth={1.5}
                                            dot={false}
                                            strokeDasharray="4 2"
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Comparação ───────────────────────────────────────────── */}
                <TabsContent value="comparison" className="space-y-4 mt-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Metric selector */}
                        <Select
                            value={focusMetric}
                            onValueChange={(v) => { setFilter("metric", v); setPage(0); }}
                        >
                            <SelectTrigger className="w-[200px]" data-testid="select-metric">
                                <SelectValue placeholder="Métrica" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMetrics.length ? (
                                    availableMetrics.map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {k.replace(/_/g, " ")}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="revenue">revenue</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Ranking de Escolas</CardTitle>
                            <CardDescription>
                                {focusMetric.replace(/_/g, " ")} · {periodLabel}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-2 p-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : !comparisons?.length ? (
                                <p className="text-sm text-muted-foreground text-center py-10">
                                    Nenhum dado de comparação para este período
                                </p>
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">#</TableHead>
                                                <TableHead>Escola</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                                <TableHead className="text-right">Δ Rede</TableHead>
                                                <TableHead className="w-10" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {comparisons.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() =>
                                                        setLocation(
                                                            `/school-dashboard${buildQueryString({
                                                                school: row.schoolId,
                                                                metric: row.metricKey,
                                                            })}`
                                                        )
                                                    }
                                                    data-testid={`row-comparison-${row.schoolId}`}
                                                >
                                                    <TableCell className="font-bold text-lg text-muted-foreground">
                                                        {row.rank}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {schoolNames[row.schoolId] ?? row.schoolId.slice(0, 8)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatMetric(row.metricKey, row.metricValue)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <VarianceBadge value={row.varianceToNetwork} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {/* Pagination */}
                                    <div className="flex items-center justify-end gap-2 p-3 border-t">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={page === 0}
                                            onClick={() => setPage((p) => p - 1)}
                                            data-testid="button-page-prev"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Página {page + 1}
                                        </span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={comparisons.length < PAGE_SIZE}
                                            onClick={() => setPage((p) => p + 1)}
                                            data-testid="button-page-next"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Heatmap ──────────────────────────────────────────────── */}
                <TabsContent value="heatmap" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Heatmap de Desempenho</CardTitle>
                            <CardDescription>
                                Todas as métricas × escolas · {periodLabel} · cor = intensidade relativa
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {heatmapLoading ? (
                                <Skeleton className="h-64 w-full" />
                            ) : (
                                <SchoolComparisonHeatmap
                                    rows={allComparisons ?? []}
                                    schoolNames={schoolNames}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
