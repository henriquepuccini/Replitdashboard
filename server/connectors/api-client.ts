import { storage } from "../storage";
import type { Connector } from "@shared/schema";

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  oauth?: {
    accessToken: string;
    refreshToken?: string;
    tokenEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
    expiresAt?: number;
  };
  headers?: Record<string, string>;
  dataPath?: string;
  paginationType?: "offset" | "cursor" | "page" | "none";
  pageSize?: number;
}

export interface FetchResult {
  data: Record<string, unknown>[];
  rawResponse: string;
  nextCursor?: string;
  hasMore: boolean;
  totalFetched: number;
}

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExponentialDelay(attempt: number, opts: RetryOptions): number {
  const delay = opts.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * opts.baseDelayMs * 0.5;
  return Math.min(delay + jitter, opts.maxDelayMs);
}

function isRetryableError(status: number): boolean {
  return status === 429 || status >= 500;
}

async function refreshOAuthToken(
  connector: Connector,
  oauthConfig: NonNullable<ApiClientConfig["oauth"]>
): Promise<string> {
  if (!oauthConfig.refreshToken || !oauthConfig.tokenEndpoint) {
    throw new Error(
      "OAuth refresh failed: missing refreshToken or tokenEndpoint"
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: oauthConfig.refreshToken,
    ...(oauthConfig.clientId && { client_id: oauthConfig.clientId }),
    ...(oauthConfig.clientSecret && {
      client_secret: oauthConfig.clientSecret,
    }),
  });

  const response = await fetch(oauthConfig.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token refresh failed (${response.status}): ${text}`);
  }

  const tokenData = (await response.json()) as Record<string, unknown>;
  const newAccessToken = tokenData.access_token as string;
  const newRefreshToken =
    (tokenData.refresh_token as string) || oauthConfig.refreshToken;
  const expiresIn = (tokenData.expires_in as number) || 3600;

  const updatedConfig = {
    ...(connector.config as Record<string, unknown>),
    oauth: {
      ...oauthConfig,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    },
  };

  await storage.updateConnector(connector.id, { config: updatedConfig });

  return newAccessToken;
}

function extractDataFromResponse(
  responseBody: unknown,
  dataPath?: string
): Record<string, unknown>[] {
  if (!dataPath) {
    if (Array.isArray(responseBody)) return responseBody;
    if (
      typeof responseBody === "object" &&
      responseBody !== null
    ) {
      const obj = responseBody as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data;
      if (Array.isArray(obj.results)) return obj.results;
      if (Array.isArray(obj.records)) return obj.records;
      if (Array.isArray(obj.items)) return obj.items;
      return [obj];
    }
    return [];
  }

  const parts = dataPath.split(".");
  let current: unknown = responseBody;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return [];
    current = (current as Record<string, unknown>)[part];
  }

  if (Array.isArray(current)) return current;
  if (typeof current === "object" && current !== null) {
    return [current as Record<string, unknown>];
  }
  return [];
}

function buildAuthHeaders(config: ApiClientConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...config.headers,
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  } else if (config.oauth?.accessToken) {
    headers["Authorization"] = `Bearer ${config.oauth.accessToken}`;
  }

  return headers;
}

export async function fetchConnectorData(
  connector: Connector,
  options: {
    cursor?: string;
    offset?: number;
    page?: number;
    retry?: Partial<RetryOptions>;
  } = {}
): Promise<FetchResult> {
  const config = connector.config as unknown as ApiClientConfig;

  if (!config.baseUrl) {
    throw new Error("Connector config missing baseUrl");
  }

  if (
    config.oauth?.expiresAt &&
    config.oauth.expiresAt < Date.now() + 60000
  ) {
    const newToken = await refreshOAuthToken(connector, config.oauth);
    config.oauth.accessToken = newToken;
  }

  const retryOpts = { ...DEFAULT_RETRY, ...options.retry };
  const url = new URL(config.baseUrl);

  const paginationType = config.paginationType || "none";
  const pageSize = config.pageSize || 100;

  if (paginationType === "offset") {
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(options.offset || 0));
  } else if (paginationType === "cursor" && options.cursor) {
    url.searchParams.set("cursor", options.cursor);
    url.searchParams.set("limit", String(pageSize));
  } else if (paginationType === "page") {
    url.searchParams.set("page", String(options.page || 1));
    url.searchParams.set("per_page", String(pageSize));
  }

  const headers = buildAuthHeaders(config);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryOpts.maxAttempts; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (isRetryableError(response.status) && attempt < retryOpts.maxAttempts - 1) {
          const delay = response.status === 429
            ? parseInt(response.headers.get("retry-after") || "0", 10) * 1000 || getExponentialDelay(attempt, retryOpts)
            : getExponentialDelay(attempt, retryOpts);
          console.warn(
            `[sync] Retryable error ${response.status} from ${url}, attempt ${attempt + 1}/${retryOpts.maxAttempts}, waiting ${delay}ms`
          );
          await sleep(delay);
          continue;
        }

        const errorText = await response.text();
        throw new Error(
          `API request failed (${response.status}): ${errorText.slice(0, 500)}`
        );
      }

      const rawText = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Invalid JSON response from ${url}: ${rawText.slice(0, 200)}`
        );
      }

      const data = extractDataFromResponse(body, config.dataPath);

      let hasMore = false;
      let nextCursor: string | undefined;

      if (paginationType !== "none" && data.length >= pageSize) {
        hasMore = true;
        if (
          paginationType === "cursor" &&
          typeof body === "object" &&
          body !== null
        ) {
          const obj = body as Record<string, unknown>;
          nextCursor =
            (obj.next_cursor as string) ||
            (obj.cursor as string) ||
            (obj.next as string) ||
            undefined;
          if (!nextCursor) hasMore = false;
        }
      }

      return {
        data,
        rawResponse: rawText,
        nextCursor,
        hasMore,
        totalFetched: data.length,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retryOpts.maxAttempts - 1) {
        const isTimeout =
          lastError.name === "TimeoutError" ||
          lastError.message.includes("timeout");
        const isNetwork =
          lastError.message.includes("ECONNREFUSED") ||
          lastError.message.includes("ENOTFOUND") ||
          lastError.message.includes("fetch failed");

        if (isTimeout || isNetwork) {
          const delay = getExponentialDelay(attempt, retryOpts);
          console.warn(
            `[sync] Network error, attempt ${attempt + 1}/${retryOpts.maxAttempts}, waiting ${delay}ms: ${lastError.message}`
          );
          await sleep(delay);
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Retry exhausted with no error captured");
}
