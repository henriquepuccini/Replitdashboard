/**
 * google-sheets-client.ts
 *
 * Fetches data from a Google Sheets spreadsheet and returns it in the same
 * FetchResult format used by api-client.ts, so it integrates transparently
 * with sync-engine.ts.
 *
 * Config shape (stored in connectors.config):
 * {
 *   spreadsheetId: string;
 *   sheetName: string;        // name of the sheet tab
 *   range: string;            // A1 notation, e.g. "A1:Z1000"
 *   firstRowIsHeader?: boolean; // default true
 *   sourceIdField?: string;   // header column to use as unique row ID; defaults to first column
 *   oauth: {
 *     clientId: string;
 *     clientSecret: string;
 *     refreshToken: string;
 *     accessToken?: string;
 *     expiresAt?: number;     // Unix timestamp in ms
 *   };
 * }
 */

import { google } from "googleapis";
import { storage } from "../storage";
import type { Connector } from "@shared/schema";
import type { FetchResult } from "./api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleSheetsOAuthConfig {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accessToken?: string;
    expiresAt?: number;
}

export interface GoogleSheetsConfig {
    spreadsheetId: string;
    sheetName: string;
    range: string;
    firstRowIsHeader?: boolean;
    sourceIdField?: string;
    oauth: GoogleSheetsOAuthConfig;
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Checks whether the stored access token has expired (with a 60-second
 * buffer) and, if so, uses the refresh token to obtain a new one.
 * Persists the new tokens back to connectors.config.
 *
 * Returns the valid access token.
 */
async function ensureValidToken(
    connector: Connector,
    oauth: GoogleSheetsOAuthConfig
): Promise<string> {
    const needsRefresh =
        !oauth.accessToken ||
        (oauth.expiresAt !== undefined && oauth.expiresAt < Date.now() + 60_000);

    if (!needsRefresh && oauth.accessToken) {
        return oauth.accessToken;
    }

    console.info(
        `[google-sheets] Refreshing OAuth token for connector ${connector.id}`
    );

    const oauthClient = new google.auth.OAuth2(
        oauth.clientId,
        oauth.clientSecret
    );

    oauthClient.setCredentials({ refresh_token: oauth.refreshToken });

    let refreshResult: { credentials: { access_token?: string | null; expiry_date?: number | null } };
    try {
        refreshResult = await oauthClient.refreshAccessToken();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[google-sheets] OAuth token refresh failed: ${msg}`);
    }

    const newAccessToken = refreshResult.credentials.access_token;
    if (!newAccessToken) {
        throw new Error(
            "[google-sheets] OAuth token refresh returned no access_token"
        );
    }

    const newExpiresAt =
        refreshResult.credentials.expiry_date ?? Date.now() + 3_600_000;

    // Persist refreshed tokens back to connector config
    const updatedConfig = {
        ...(connector.config as Record<string, unknown>),
        oauth: {
            ...oauth,
            accessToken: newAccessToken,
            expiresAt: newExpiresAt,
        },
    };
    await storage.updateConnector(connector.id, { config: updatedConfig });

    return newAccessToken;
}

// ─── Cell Normalization ───────────────────────────────────────────────────────

/**
 * Coerces a raw spreadsheet cell string to the most appropriate JS type.
 *
 * Rules:
 *   - Empty / whitespace-only string → null
 *   - Pure integer string              → number (integer)
 *   - Pure decimal string              → number (float)
 *   - ISO 8601 date string             → kept as string (transforms handle casting)
 *   - Everything else                  → trimmed string
 */
function normalizeCell(raw: string): unknown {
    const trimmed = raw.trim();

    if (trimmed === "") return null;

    // Integer
    if (/^-?\d+$/.test(trimmed)) {
        const n = parseInt(trimmed, 10);
        if (!isNaN(n)) return n;
    }

    // Float
    if (/^-?\d+\.\d+$/.test(trimmed)) {
        const n = parseFloat(trimmed);
        if (!isNaN(n)) return n;
    }

    return trimmed;
}

// ─── Data Parsing ─────────────────────────────────────────────────────────────

/**
 * Converts the raw 2-D array returned by the Sheets API into an array of
 * plain objects.  The first row (when firstRowIsHeader is true) is used as
 * header names.  Missing trailing cells in a row are filled with null.
 */
function parseSheetValues(
    values: string[][],
    firstRowIsHeader: boolean
): Record<string, unknown>[] {
    if (!values || values.length === 0) return [];

    let headers: string[];
    let dataRows: string[][];

    if (firstRowIsHeader) {
        headers = values[0].map((h, i) =>
            h && h.trim() !== "" ? h.trim() : `col_${i}`
        );
        dataRows = values.slice(1);
    } else {
        const maxCols = Math.max(...values.map((r) => r.length));
        headers = Array.from({ length: maxCols }, (_, i) => `col_${i}`);
        dataRows = values;
    }

    return dataRows.map((row) =>
        Object.fromEntries(
            headers.map((header, colIdx) => {
                const raw = row[colIdx] ?? "";
                return [header, normalizeCell(raw)];
            })
        )
    );
}

// ─── Main fetch function ──────────────────────────────────────────────────────

/**
 * Fetches rows from a Google Sheets spreadsheet and returns them as a
 * FetchResult compatible with sync-engine's pipeline.
 *
 * Google Sheets does not paginate via cursors/offsets.  A single API call
 * returns the entire requested range; therefore hasMore is always false.
 */
export async function fetchGoogleSheetData(
    connector: Connector
): Promise<FetchResult> {
    const config = connector.config as unknown as GoogleSheetsConfig;

    // ── Validate required config fields ────────────────────────────────────────
    if (!config.spreadsheetId) {
        throw new Error(
            `[google-sheets] Connector ${connector.id} missing config.spreadsheetId`
        );
    }
    if (!config.sheetName) {
        throw new Error(
            `[google-sheets] Connector ${connector.id} missing config.sheetName`
        );
    }
    if (!config.range) {
        throw new Error(
            `[google-sheets] Connector ${connector.id} missing config.range`
        );
    }
    if (!config.oauth?.clientId || !config.oauth?.clientSecret || !config.oauth?.refreshToken) {
        throw new Error(
            `[google-sheets] Connector ${connector.id} missing OAuth credentials (clientId, clientSecret, refreshToken)`
        );
    }

    // ── Refresh token if necessary ─────────────────────────────────────────────
    const accessToken = await ensureValidToken(connector, config.oauth);

    // ── Instantiate Sheets client ──────────────────────────────────────────────
    const oauthClient = new google.auth.OAuth2(
        config.oauth.clientId,
        config.oauth.clientSecret
    );
    oauthClient.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: "v4", auth: oauthClient });

    // ── Build A1 range notation: "SheetName!A1:Z1000" ─────────────────────────
    const a1Range = `${config.sheetName}!${config.range}`;

    console.info(
        `[google-sheets] Fetching connector ${connector.id}: ${config.spreadsheetId} / ${a1Range}`
    );

    let rawValues: string[][];
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: a1Range,
            valueRenderOption: "UNFORMATTED_VALUE",  // numbers as numbers, not formatted strings
            dateTimeRenderOption: "FORMATTED_STRING", // dates as readable strings
        });

        rawValues = (response.data.values ?? []) as string[][];
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
            `[google-sheets] Sheets API request failed for connector ${connector.id}: ${msg}`
        );
    }

    // ── Parse into records ─────────────────────────────────────────────────────
    const firstRowIsHeader = config.firstRowIsHeader !== false; // default true
    const records = parseSheetValues(rawValues, firstRowIsHeader);

    const rawResponse = JSON.stringify({ spreadsheetId: config.spreadsheetId, range: a1Range, values: rawValues });

    console.info(
        `[google-sheets] Connector ${connector.id}: fetched ${records.length} rows from ${a1Range}`
    );

    return {
        data: records,
        rawResponse,
        hasMore: false,
        totalFetched: records.length,
    };
}
