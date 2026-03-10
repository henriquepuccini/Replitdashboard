import { useMemo } from "react";
import type React from "react";
import { format } from "date-fns";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { AlertTriangle, TrendingDown, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useChurnBreakdown,
    type ChurnBreakdownItem,
} from "@/hooks/use-churn";

// ─── Colour palette ──────────────────────────────────────────────────────────

const MOTIVE_COLORS: Record<string, string> = {
    adaptation_failure: "#ef4444", // red — critical
    financial_issues: "#f97316", // orange
    transfer: "#8b5cf6", // violet
    relocation: "#3b82f6", // blue
    other: "#6b7280", // grey
    unclassified: "#d1d5db", // light grey
};

const DEFAULT_COLOR = "#6b7280";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ─── Custom tooltip ──────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const item: ChurnBreakdownItem = payload[0].payload;
    return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-md text-sm space-y-1">
            <p className="font-semibold">{item.label}</p>
            <p className="text-muted-foreground">{item.count} cancelamentos</p>
            <p className="text-muted-foreground">LTV perdido: {BRL(item.ltvLostTotal)}</p>
            {item.isCritical && (
                <p className="text-destructive text-xs font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Métrica crítica
                </p>
            )}
        </div>
    );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

interface ChurnMotivesWidgetProps {
    schoolId?: string;
    from?: Date;
    to?: Date;
    periodLabel?: string;
    schoolName?: string;
}

export function ChurnMotivesWidget({
    schoolId,
    from,
    to,
    periodLabel,
    schoolName,
}: ChurnMotivesWidgetProps) {
    const fromStr = from ? format(from, "yyyy-MM-dd") : undefined;
    const toStr = to ? format(to, "yyyy-MM-dd") : undefined;

    const { data, isLoading } = useChurnBreakdown({ schoolId, from: fromStr, to: toStr });

    // Pie chart data — exclude zero-count items
    const pieData = useMemo(
        () => (data?.breakdown ?? []).filter((r) => r.count > 0),
        [data]
    );

    const totalLtvLost = useMemo(
        () => pieData.reduce((sum, r) => sum + r.ltvLostTotal, 0),
        [pieData]
    );

    const adaptationItem = pieData.find((r) => r.code === "adaptation_failure");

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    const isEmpty = !data || data.totalCancellations === 0;

    return (
        <div className="space-y-4">
            {/* KPI summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<Users className="h-4 w-4" />}
                    label="Total cancelamentos"
                    value={String(data?.totalCancellations ?? 0)}
                />
                <SummaryCard
                    icon={<DollarSign className="h-4 w-4" />}
                    label="LTV perdido"
                    value={BRL(totalLtvLost)}
                />
                <SummaryCard
                    icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
                    label="Falha de Adaptação"
                    value={`${data?.adaptationRate ?? 0}%`}
                    critical={!!adaptationItem && adaptationItem.count > 0}
                />
                <SummaryCard
                    icon={<TrendingDown className="h-4 w-4" />}
                    label="LTV médio perdido"
                    value={
                        data?.totalCancellations
                            ? BRL(totalLtvLost / data.totalCancellations)
                            : "—"
                    }
                />
            </div>

            {isEmpty ? (
                <Card>
                    <CardContent className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                        Nenhuma matrícula cancelada no período selecionado
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Pie chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Motivos de Cancelamento</CardTitle>
                            <CardDescription>
                                {schoolName ?? "Rede"} · {periodLabel ?? "Período selecionado"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="count"
                                        nameKey="label"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        strokeWidth={0}
                                    >
                                        {pieData.map((entry) => (
                                            <Cell
                                                key={entry.code}
                                                fill={MOTIVE_COLORS[entry.code] ?? DEFAULT_COLOR}
                                                opacity={entry.isCritical ? 1 : 0.8}
                                            />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<PieTooltip />} />
                                    <Legend
                                        formatter={(value, entry: any) => (
                                            <span className="text-xs">
                                                {entry.payload.label}
                                                {entry.payload.isCritical && (
                                                    <span className="ml-1 text-destructive text-[10px]">⚠</span>
                                                )}
                                            </span>
                                        )}
                                        wrapperStyle={{ fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Critical flag */}
                            {adaptationItem && adaptationItem.count > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>
                                        <strong>{adaptationItem.count}</strong> cancelamentos por Falha de Adaptação
                                        ({data?.adaptationRate}%) — recomenda-se revisão do processo de onboarding.
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Motive breakdown table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Detalhamento por Motivo</CardTitle>
                            <CardDescription>LTV perdido e volume por categoria</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {pieData.map((item) => {
                                    const pct =
                                        data!.totalCancellations > 0
                                            ? Math.round((item.count / data!.totalCancellations) * 100)
                                            : 0;
                                    return (
                                        <div
                                            key={item.code}
                                            className="flex items-center justify-between px-4 py-3 text-sm"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                    style={{ background: MOTIVE_COLORS[item.code] ?? DEFAULT_COLOR } as React.CSSProperties}
                                                />
                                                <span className="font-medium">{item.label}</span>
                                                {item.isCritical && (
                                                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                                        Crítico
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-muted-foreground">
                                                <span>{item.count} ({pct}%)</span>
                                                <span className="tabular-nums">{BRL(item.ltvLostTotal)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bar chart */}
                            <div className="px-4 pt-4 pb-2">
                                <ResponsiveContainer width="100%" height={120}>
                                    <BarChart
                                        data={pieData}
                                        layout="vertical"
                                        margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="label"
                                            width={0}
                                            tick={false}
                                            axisLine={false}
                                        />
                                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                            {pieData.map((entry) => (
                                                <Cell
                                                    key={entry.code}
                                                    fill={MOTIVE_COLORS[entry.code] ?? DEFAULT_COLOR}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
    icon,
    label,
    value,
    critical,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    critical?: boolean;
}) {
    return (
        <Card className={critical ? "border-destructive/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <div
                    className={`h-7 w-7 rounded-md flex items-center justify-center ${critical ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        }`}
                >
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-bold ${critical ? "text-destructive" : ""}`}>{value}</div>
            </CardContent>
        </Card>
    );
}
