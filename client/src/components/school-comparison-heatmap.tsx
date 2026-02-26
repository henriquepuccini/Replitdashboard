import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import type { SchoolComparison } from "@shared/schema";

// ---------------------------------------------------------------------------
// Color scale: maps a 0-1 normalized value to a CSS HSL color.
// Low (cold) → blue, high (hot) → green or red depending on context.
// We use green for "higher = better" by default.
// ---------------------------------------------------------------------------

function cellColor(normalized: number): string {
    // Interpolate from slate-100 (0) → emerald-500 (1)
    const hue = 155; // emerald green
    const lightness = Math.round(95 - normalized * 55); // 95% → 40%
    const saturation = Math.round(20 + normalized * 60); // 20% → 80%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function varianceBadge(v: number | null): React.ReactNode {
    if (v === null) return null;
    const sign = v >= 0 ? "+" : "";
    const color =
        v >= 0
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
    return (
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${color}`}>
            {sign}{v.toFixed(1)}%
        </span>
    );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SchoolComparisonHeatmapProps {
    /** All rows for all metrics (not filtered to a single metricKey) */
    rows: SchoolComparison[];
    /** Map of schoolId → school name for display */
    schoolNames: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchoolComparisonHeatmap({
    rows,
    schoolNames,
}: SchoolComparisonHeatmapProps) {
    const { setFilters } = useDashboardFilters();

    // Collect unique metric keys and school IDs, preserving stable order
    const metricKeys = Array.from(new Set(rows.map((r) => r.metricKey))).sort();
    const schoolIds = Array.from(new Set(rows.map((r) => r.schoolId)));

    // Build a lookup: metricKey → schoolId → row
    const lookup: Record<string, Record<string, SchoolComparison>> = {};
    for (const row of rows) {
        if (!lookup[row.metricKey]) lookup[row.metricKey] = {};
        lookup[row.metricKey][row.schoolId] = row;
    }

    // Per metric: compute min and max for normalization
    const metricRanges: Record<string, { min: number; max: number }> = {};
    for (const key of metricKeys) {
        const vals = schoolIds
            .map((sid) => lookup[key]?.[sid]?.metricValue)
            .filter((v): v is number => v !== undefined);
        metricRanges[key] = {
            min: Math.min(...vals),
            max: Math.max(...vals),
        };
    }

    if (!metricKeys.length || !schoolIds.length) {
        return (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Nenhum dado de comparação disponível
            </div>
        );
    }

    const colWidth = Math.max(80, Math.floor(640 / schoolIds.length));

    return (
        <div className="overflow-auto" data-testid="heatmap-container">
            <table className="text-xs border-separate border-spacing-0.5 min-w-full">
                <thead>
                    <tr>
                        {/* Top-left corner */}
                        <th className="text-left text-muted-foreground font-medium px-2 py-1 whitespace-nowrap min-w-[120px]">
                            Métrica
                        </th>
                        {schoolIds.map((sid) => (
                            <th
                                key={sid}
                                className="font-medium text-center text-muted-foreground px-1 py-1 whitespace-nowrap"
                                style={{ minWidth: colWidth }}
                            >
                                {schoolNames[sid] ?? sid.slice(0, 8)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {metricKeys.map((metricKey) => {
                        const { min, max } = metricRanges[metricKey];
                        return (
                            <tr key={metricKey}>
                                <td className="text-muted-foreground font-medium pr-3 py-0.5 whitespace-nowrap">
                                    {metricKey.replace(/_/g, " ")}
                                </td>
                                {schoolIds.map((sid) => {
                                    const row = lookup[metricKey]?.[sid];
                                    const normalized =
                                        row && max > min ? (row.metricValue - min) / (max - min) : 0;
                                    const bg = row ? cellColor(normalized) : "hsl(220, 13%, 91%)";

                                    return (
                                        <td key={sid} className="py-0.5 px-0.5">
                                            <button
                                                className="w-full rounded flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                                style={{ backgroundColor: bg, minWidth: colWidth - 4 }}
                                                onClick={() =>
                                                    setFilters({
                                                        school: sid,
                                                        metric: metricKey,
                                                    })
                                                }
                                                title={
                                                    row
                                                        ? `${metricKey} · ${schoolNames[sid]}: ${row.metricValue.toLocaleString("pt-BR")} (rank ${row.rank})`
                                                        : "Sem dados"
                                                }
                                                data-testid={`heatmap-cell-${metricKey}-${sid}`}
                                            >
                                                {row ? (
                                                    <>
                                                        <span className="font-semibold text-slate-800">
                                                            #{row.rank}
                                                        </span>
                                                        {varianceBadge(row.varianceToNetwork)}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
