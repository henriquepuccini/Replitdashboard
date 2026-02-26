import { useState, useCallback } from "react";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface UseApiOptions<TData> {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
}

/**
 * A centralized hook for interacting with the backend API.
 * Primarily designed for mutations and programmatic fetches outside of standard
 * React Query GET workflows. Includes automatic global error toast handling.
 */
export function useApi<TData = unknown>() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const { toast } = useToast();

    const fetchApi = useCallback(
        async (
            method: ApiMethod,
            url: string,
            body?: unknown,
            options?: UseApiOptions<TData>
        ): Promise<TData | undefined> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await apiRequest(method, url, body);

                // Let apiRequest throw if !res.ok, so we handle it gracefully here
                const data = (await response.json()) as TData;

                if (options?.successMessage) {
                    toast({
                        title: "Success",
                        description: options.successMessage,
                    });
                }

                options?.onSuccess?.(data);
                return data;

            } catch (err) {
                const _error = err instanceof Error ? err : new Error(String(err));
                setError(_error);

                // Global Error Formatter
                let title = "Error";
                let description = _error.message;

                if (description.includes("401")) {
                    title = "Unauthorized";
                    description = "Please log in to continue.";
                } else if (description.includes("403")) {
                    title = "Forbidden";
                    description = "You don't have permission to perform this action.";
                } else if (description.includes("500")) {
                    title = "Server Error";
                    description = "An unexpected error occurred on the server.";
                }

                toast({
                    variant: "destructive",
                    title,
                    description,
                });

                options?.onError?.(_error);
                throw _error; // Rethrow to allow caller to handle if needed
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    return {
        fetchApi,
        isLoading,
        error,
        isError: error !== null,
    };
}
