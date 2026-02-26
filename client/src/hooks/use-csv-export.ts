import { useState, useCallback } from "react";
import { exportToCsv } from "@/lib/export-utils";

interface CsvColumn<T> {
    label: string;
    key: keyof T;
}

interface UseCsvExportOptions<T> {
    filename: string;
    columns?: CsvColumn<T>[];
    /**
     * Optional async function to fetch all data if the current table is paginated.
     * If omitted, it will immediately export the provided data array.
     */
    fetchData?: () => Promise<T[]>;
}

export function useCsvExport<T>() {
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const exportData = useCallback(
        async (
            data: T[],
            options: UseCsvExportOptions<T>
        ) => {
            setIsExporting(true);
            setError(null);
            try {
                let exportableData = data;

                if (options.fetchData) {
                    exportableData = await options.fetchData();
                }

                exportToCsv(options.filename, exportableData, options.columns);
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to export CSV"));
                throw err;
            } finally {
                setIsExporting(false);
            }
        },
        []
    );

    return { exportData, isExporting, error };
}
