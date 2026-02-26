import { useLocation } from "wouter";
import { useCallback, useMemo } from "react";

/**
 * Filter keys parsed and mapped to their appropriate types.
 */
export interface DashboardFilters {
    periodMonths: number;
    metric: string;
    schoolId: string | null;
    sellerId: string | null;
}

const DEFAULT_FILTERS: DashboardFilters = {
    periodMonths: 3,
    metric: "revenue",
    schoolId: null,
    sellerId: null,
};

export function useDashboardFilters() {
    const [location, setLocation] = useLocation();

    // Extract search params from window.location since wouter's useLocation
    // only returns the pathname by default in version 3.x
    const search = typeof window !== "undefined" ? window.location.search : "";

    // Parse current URL filters with stable reference
    const filters = useMemo<DashboardFilters>(() => {
        const params = new URLSearchParams(search);

        const periodStr = params.get("period");
        const periodMonths = periodStr ? parseInt(periodStr, 10) : DEFAULT_FILTERS.periodMonths;

        return {
            periodMonths: isNaN(periodMonths) ? DEFAULT_FILTERS.periodMonths : periodMonths,
            metric: params.get("metric") || DEFAULT_FILTERS.metric,
            schoolId: params.get("school") || DEFAULT_FILTERS.schoolId,
            sellerId: params.get("seller") || DEFAULT_FILTERS.sellerId,
        };
    }, [search]);

    /**
     * Generates a new query string by merging current filters with overrides.
     */
    const buildQueryString = useCallback(
        (overrides: Partial<Record<"period" | "metric" | "school" | "seller", string | number | null>>) => {
            const params = new URLSearchParams(search);

            for (const [key, value] of Object.entries(overrides)) {
                if (value === null || value === undefined) {
                    params.delete(key);
                } else {
                    params.set(key, String(value));
                }
            }

            const qs = params.toString();
            return qs ? `?${qs}` : "";
        },
        [search]
    );

    /**
     * Sets a single filter in the URL, preserving other existing query parameters.
     */
    const setFilter = useCallback(
        (key: "period" | "metric" | "school" | "seller", value: string | number | null) => {
            const qs = buildQueryString({ [key]: value });
            setLocation(`${location}${qs}`, { replace: true });
        },
        [location, setLocation, buildQueryString]
    );

    /**
     * Sets multiple filters simultaneously.
     */
    const setFilters = useCallback(
        (overrides: Partial<Record<"period" | "metric" | "school" | "seller", string | number | null>>) => {
            const qs = buildQueryString(overrides);
            setLocation(`${location}${qs}`, { replace: true });
        },
        [location, setLocation, buildQueryString]
    );

    return {
        filters,
        search,
        setFilter,
        setFilters,
        buildQueryString,
    };
}
