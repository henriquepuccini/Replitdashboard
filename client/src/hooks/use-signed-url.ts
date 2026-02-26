import { useState, useCallback } from "react";
import { useApi } from "./use-api";

interface SignedUrlResponse {
    url: string;
}

export function useSignedUrl() {
    const { fetchApi, isLoading, error } = useApi<SignedUrlResponse>();
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    const getUrl = useCallback(
        async (bucketPath: string, bucketId: string = "reports"): Promise<string> => {
            const { url } = await fetchApi(
                "POST",
                "/api/storage/signed-url",
                { path: bucketPath, bucket: bucketId }
            ) || {};

            if (url) {
                setSignedUrl(url);
            }
            return url || "";
        },
        [fetchApi]
    );

    return {
        signedUrl,
        getUrl,
        isLoading,
        error,
    };
}
