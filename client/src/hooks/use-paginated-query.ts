import { useState, useCallback, useEffect } from "react";
import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";

interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
}

interface UsePaginatedQueryOptions<TData, TError = unknown>
    extends Omit<UseQueryOptions<PaginatedResult<TData>, TError>, "queryKey" | "queryFn"> {
    queryKeyPrefix: readonly unknown[];
    fetchFn: (page: number, limit: number) => Promise<PaginatedResult<TData>>;
    initialPage?: number;
    limit?: number;
}

/**
 * Standardized pagination hook encapsulating React Query.
 * Handles page state, limit state, and orchestrates fetching automatically.
 */
export function usePaginatedQuery<TData, TError = unknown>({
    queryKeyPrefix,
    fetchFn,
    initialPage = 1,
    limit = 50,
    ...queryOptions
}: UsePaginatedQueryOptions<TData, TError>) {
    const [page, setPage] = useState(initialPage);

    // Sync state upward if initialPage prop changes
    useEffect(() => {
        setPage(initialPage);
    }, [initialPage]);

    // Construct a deterministic array key for caching isolation per-page
    const queryKey = [...queryKeyPrefix, { page, limit }] as const;

    const queryResult = useQuery<PaginatedResult<TData>, TError>({
        queryKey,
        queryFn: () => fetchFn(page, limit),
        // Keep standard pagination UX smooth by retaining previous data while fetching next
        placeholderData: (previousData) => previousData,
        ...queryOptions,
    });

    const handleNextPage = useCallback(() => {
        if (queryResult.data && page < queryResult.data.totalPages) {
            setPage((p) => p + 1);
        }
    }, [page, queryResult.data]);

    const handlePrevPage = useCallback(() => {
        if (page > 1) {
            setPage((p) => p - 1);
        }
    }, [page]);

    const handlePageSelect = useCallback((selectedPage: number) => {
        if (
            selectedPage >= 1 &&
            (!queryResult.data || selectedPage <= queryResult.data.totalPages)
        ) {
            setPage(selectedPage);
        }
    }, [queryResult.data]);

    return {
        ...queryResult,
        page,
        limit,
        nextPage: handleNextPage,
        prevPage: handlePrevPage,
        setPage: handlePageSelect,
        hasNextPage: queryResult.data ? page < queryResult.data.totalPages : false,
        hasPrevPage: page > 1,
    };
}
