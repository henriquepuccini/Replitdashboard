import { useMemo } from "react";
import { format } from "date-fns";
import {
    ResponsiveContainer,
    FunnelChart,
    Funnel,
    LabelList,
    Tooltip as RechartsTooltip,
} from "recharts";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversionFunnel, type FunnelFilters } from "@/hooks/use-leads";

// ─── Colour ramp for funnel steps ────────────────────────────────────────────

const STAGE_COLORS = [
    "#6366f1", // indigo – top
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#10b981", // green – bottom (won)
];

const SOURCE_LABELS: Record<string, string> = {
    form: "Formulário",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    google_ads: "Google Ads",
    referral: "Indicação",
    other: "Outro",
    unknown: "Desconhecido",
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function FunnelTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-md text-sm space-y-1">
            <p className="font-semibold">{item.label}</p>
            <p className="text-muted-foreground">{item.count} leads</p>
            <p className="text-muted-foreground">
                Taxa de alcance: <strong>{item.conversionRate}%</strong>
            </p>
            {item.stageDropOffRate > 0 && (
                <p className="text-destructive text-xs">
                    ▼ {item.stageDropOffRate}% drop-off do estágio anterior
                </p>
            )}
        </div>
    );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

interface ConversionFunnelWidgetProps {
    schoolId?: string;
    from?: Date;
    to?: Date;
    periodLabel?: string;
    schoolName?: string;
}

export function ConversionFunnelWidget({
    schoolId,
    from,
    to,
    periodLabel,
    schoolName,
}: ConversionFunnelWidgetProps) {
    const filters: FunnelFilters = {
        ...(schoolId ? { school_id: schoolId } : {}),
        ...(from ? { period_start: format(from, "yyyy-MM-dd") } : {}),
        ...(to ? { period_end: format(to, "yyyy-MM-dd") } : {}),
    };

    const { data, isLoading } = useConversionFunnel(filters);

    const funnelData = useMemo(
        () =>
            (data?.stages ?? []).map((s, i) => ({
                ...s,
                value: s.count,
                fill: STAGE_COLORS[i] ?? "#6366f1",
            })),
        [data]
    );

    const sourceEntries = useMemo(
        () =>
            Object.entries(data?.sourceBreakdown ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
        [data]
    );

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-80 w-full rounded-xl" />
                <Skeleton className="h-80 w-full rounded-xl" />
            </div>
        );
    }

    const isEmpty = !data || data.totalLeads === 0;

    const overallConversion =
        data && data.totalLeads > 0
            ? ((data.totalConverted / data.totalLeads) * 100).toFixed(1)
            : "0";

    return (
        <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
                <SummaryCard
                    icon={<Users className="h-4 w-4" />}
                    label="Total de Leads"
                    value={String(data?.totalLeads ?? 0)}
                />
                <SummaryCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Convertidos"
                    value={String(data?.totalConverted ?? 0)}
                    positive
                />
                <SummaryCard
                    icon={<TrendingDown className="h-4 w-4" />}
                    label="Taxa de Conversão"
                    value={`${overallConversion}%`}
                    positive={(data?.totalConverted ?? 0) > 0}
                />
            </div>

            {isEmpty ? (
                <Card>
                    <CardContent className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                        Nenhum lead no período selecionado
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Funnel chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Funil de Conversão</CardTitle>
                            <CardDescription>
                                {schoolName ?? "Rede"} · {periodLabel ?? "Período selecionado"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <FunnelChart>
                                    <RechartsTooltip content={<FunnelTooltip />} />
                                    <Funnel
                                        dataKey="value"
                                        data={funnelData}
                                        isAnimationActive
                                        lastShapeType="rectangle"
                                    >
                                        <LabelList
                                            position="right"
                                            content={({ value, name }: any) => (
                                                <text
                                                    x={name}
                                                    fontSize={12}
                                                    fill="currentColor"
                                                    className="fill-foreground"
                                                >
                                                    {value}
                                                </text>
                                            )}
                                        />
                                    </Funnel>
                                </FunnelChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Stage breakdown table + source pie */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Detalhamento por Estágio</CardTitle>
                            <CardDescription>Drop-off e taxa de alcance acumulada</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="divide-y divide-border">
                                {data?.stages.map((s, i) => (
                                    <div
                                        key={s.stage}
                                        className="flex items-center justify-between py-2.5 text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                                style={{ background: STAGE_COLORS[i] ?? "#6366f1" } as React.CSSProperties}
                                            />
                                            <span className="font-medium">{s.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <span className="tabular-nums">{s.count}</span>
                                            {s.stageDropOffRate > 0 && (
                                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                                    ▼{s.stageDropOffRate}%
                                                </Badge>
                                            )}
                                            <span
                                                className={`tabular-nums font-semibold ${s.conversionRate >= 70
                                                        ? "text-green-600"
                                                        : s.conversionRate >= 40
                                                            ? "text-amber-600"
                                                            : "text-destructive"
                                                    }`}
                                            >
                                                {s.conversionRate}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {sourceEntries.length > 0 && (
                                <>
                                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-1">
                                        Origem dos Leads
                                    </p>
                                    <div className="space-y-2">
                                        {sourceEntries.map(([src, cnt]) => {
                                            const pct =
                                                data!.totalLeads > 0
                                                    ? Math.round((cnt / data!.totalLeads) * 100)
                                                    : 0;
                                            return (
                                                <div key={src} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span>{SOURCE_LABELS[src] ?? src}</span>
                                                        <span className="text-muted-foreground">
                                                            {cnt} ({pct}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-primary/80 transition-all"
                                                            style={{ width: `${pct}%` } as React.CSSProperties}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

import type React from "react";

function SummaryCard({
    icon,
    label,
    value,
    positive,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    positive?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <div className="h-7 w-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div
                    className={`text-xl font-bold ${positive === true
                            ? "text-green-600"
                            : positive === false
                                ? "text-destructive"
                                : ""
                        }`}
                >
                    {value}
                </div>
            </CardContent>
        </Card>
    );
}
