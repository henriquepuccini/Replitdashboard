import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { KpiValue, KpiGoal } from "@shared/schema";

function formatNumber(val: string | number, decimals = 2): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function formatCurrency(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface KpiCardProps {
  title: string;
  value: string | number | null;
  previousValue?: string | number | null;
  icon?: React.ReactNode;
  format?: "number" | "currency" | "percent";
  lastComputedAt?: string | null;
  status?: string;
  onClick?: () => void;
}

export function KpiCard({
  title,
  value,
  previousValue,
  icon,
  format = "number",
  lastComputedAt,
  status,
  onClick,
}: KpiCardProps) {
  const currentVal = value != null ? parseFloat(String(value)) : null;
  const prevVal =
    previousValue != null ? parseFloat(String(previousValue)) : null;

  let displayValue = "—";
  if (currentVal != null && !isNaN(currentVal)) {
    if (format === "currency") displayValue = formatCurrency(currentVal);
    else if (format === "percent") displayValue = `${currentVal.toFixed(1)}%`;
    else displayValue = formatNumber(currentVal);
  }

  let trend: "up" | "down" | "neutral" = "neutral";
  let changePercent: number | null = null;
  if (currentVal != null && prevVal != null && prevVal !== 0) {
    changePercent = ((currentVal - prevVal) / Math.abs(prevVal)) * 100;
    trend = changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "neutral";
  }

  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
      data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "failed" && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold" data-testid={`text-kpi-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {displayValue}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {changePercent != null && (
            <span
              className={`flex items-center gap-0.5 text-xs font-medium ${
                trend === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend === "down"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
              data-testid="text-kpi-trend"
            >
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          )}
          {lastComputedAt && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {new Date(lastComputedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SparklineChartProps {
  values: KpiValue[];
  height?: number;
  color?: string;
}

const sparkConfig: ChartConfig = {
  value: { label: "Valor", color: "hsl(var(--primary))" },
};

export function SparklineChart({
  values,
  height = 60,
  color,
}: SparklineChartProps) {
  if (!values.length) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ height }}
      >
        Sem dados
      </div>
    );
  }

  const data = [...values]
    .sort(
      (a, b) =>
        new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
    )
    .map((v) => ({
      period: v.periodStart,
      value: parseFloat(v.value),
    }));

  const fillColor = color || "hsl(var(--primary))";

  return (
    <ChartContainer config={sparkConfig} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={fillColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={fillColor}
          fill="url(#sparkFill)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  );
}

interface GoalVarianceProps {
  currentValue: number | null;
  goal: KpiGoal | null;
  format?: "number" | "currency" | "percent";
}

export function GoalVariance({
  currentValue,
  goal,
  format = "number",
}: GoalVarianceProps) {
  if (currentValue == null || !goal) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Sem meta
      </Badge>
    );
  }

  const target = parseFloat(goal.target);
  if (isNaN(target) || target === 0) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Meta inválida
      </Badge>
    );
  }

  const pct = (currentValue / target) * 100;
  const variance = currentValue - target;

  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (pct >= 100) variant = "default";
  else if (pct >= 80) variant = "outline";
  else variant = "destructive";

  let varianceDisplay: string;
  if (format === "currency") varianceDisplay = formatCurrency(variance);
  else if (format === "percent") varianceDisplay = `${variance.toFixed(1)}pp`;
  else varianceDisplay = formatNumber(variance);

  return (
    <div className="flex items-center gap-1.5" data-testid="goal-variance">
      <Badge variant={variant} className="text-[10px]">
        {pct.toFixed(0)}% da meta
      </Badge>
      <span
        className={`text-[10px] font-medium ${
          variance >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {variance >= 0 ? "+" : ""}
        {varianceDisplay}
      </span>
    </div>
  );
}

interface KpiTimeseriesChartProps {
  values: KpiValue[];
  goals?: KpiGoal[];
  format?: "number" | "currency" | "percent";
  height?: number;
}

const timeseriesConfig: ChartConfig = {
  value: { label: "Valor", color: "hsl(var(--primary))" },
  target: { label: "Meta", color: "hsl(var(--muted-foreground))" },
};

export function KpiTimeseriesChart({
  values,
  goals = [],
  format = "number",
  height = 300,
}: KpiTimeseriesChartProps) {
  if (!values.length) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        Sem dados para exibir
      </div>
    );
  }

  const sorted = [...values].sort(
    (a, b) =>
      new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
  );

  const goalMap: Record<string, number> = {};
  goals.forEach((g) => {
    goalMap[g.periodStart] = parseFloat(g.target);
  });

  const data = sorted.map((v) => ({
    period: new Date(v.periodStart).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
    value: parseFloat(v.value),
    target: goalMap[v.periodStart] ?? null,
  }));

  const fmtValue = (val: number) => {
    if (format === "currency") return formatCurrency(val);
    if (format === "percent") return `${val.toFixed(1)}%`;
    return formatNumber(val);
  };

  return (
    <ChartContainer config={timeseriesConfig} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.3}
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtValue}
          width={60}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="target"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 4"
          fill="none"
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="url(#colorValue)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
