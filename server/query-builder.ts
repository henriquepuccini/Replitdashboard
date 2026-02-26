/**
 * server/query-builder.ts
 *
 * Composable, parameterized query builder for the filtering & drilldown layer.
 *
 * SECURITY:
 *  - All user-supplied values are bound as $N parameters — never interpolated.
 *  - Sort and filter fields are validated against explicit whitelists before use.
 *  - Cursor tokens are base64-encoded UUID + timestamp pairs — not SQL fragments.
 *
 * USAGE:
 *  const { sql, params } = buildKpiValueQuery(filters, pagination);
 *  const rows = await db.query(sql, params);
 */

import { pool } from "./db";
import type { QueryResult } from "pg";

// ---------------------------------------------------------------------------
// WHITELISTS — add new fields here as the schema grows
// ---------------------------------------------------------------------------

/** Columns that may be used as sort keys for kpi_values queries */
export const KPI_VALUE_SORT_FIELDS = new Set([
    "period_start",
    "period_end",
    "value",
    "computed_at",
    "created_at",
]);

/** Columns that may be used as sort keys for pipeline queries */
export const PIPELINE_SORT_FIELDS = new Set([
    "stage",
    "expected_close_date",
    "amount",
    "created_at",
    "updated_at",
]);

/** Columns that may be used as sort keys for school_aggregates queries */
export const AGGREGATE_SORT_FIELDS = new Set([
    "date",
    "computed_at",
]);

/** Columns that may be used as sort keys for school_comparison queries */
export const COMPARISON_SORT_FIELDS = new Set([
    "date",
    "metric_value",
    "rank",
    "variance_to_network",
]);

/** Top-level filter keys accepted from the client */
export const ALLOWED_FILTER_KEYS = new Set([
    "kpi_id",
    "school_id",
    "seller_id",
    "metric_key",
    "period_start",
    "period_end",
    "date_from",
    "date_to",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDirection = "ASC" | "DESC";

export interface QueryFilters {
    kpiId?: string;
    schoolId?: string;
    sellerId?: string;
    metricKey?: string;
    periodStart?: string;   // ISO date YYYY-MM-DD
    periodEnd?: string;     // ISO date YYYY-MM-DD
    dateFrom?: string;
    dateTo?: string;
}

export interface PaginationOptions {
    /** Offset-based: page number (0-indexed) */
    page?: number;
    /** Offset-based: rows per page */
    limit?: number;
    /** Cursor-based: opaque cursor from previous response */
    cursor?: string;
    /** Sort column — must be in the relevant whitelist */
    sortBy?: string;
    sortDirection?: SortDirection;
}

export interface PageInfo {
    hasNextPage: boolean;
    nextCursor: string | null;
    total?: number;
}

export interface QueryBuilderResult<T> {
    rows: T[];
    pageInfo: PageInfo;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

/** Encode a cursor from an id + tiebreaker value (ISO timestamp string). */
export function encodeCursor(id: string, tiebreaker: string): string {
    return Buffer.from(JSON.stringify({ id, t: tiebreaker })).toString("base64url");
}

/** Decode an opaque cursor. Returns null if invalid (treat as start of set). */
export function decodeCursor(cursor: string): { id: string; t: string } | null {
    try {
        const raw = Buffer.from(cursor, "base64url").toString("utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed?.id === "string" && typeof parsed?.t === "string") {
            return parsed as { id: string; t: string };
        }
        return null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertSortField(field: string, whitelist: Set<string>): string {
    if (!whitelist.has(field)) {
        throw new Error(
            `Invalid sort field "${field}". Allowed: ${Array.from(whitelist).join(", ")}`
        );
    }
    return field;
}

function safeDirection(dir?: string): SortDirection {
    return dir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
}

function safeLimit(limit?: number): number {
    const n = Number(limit) || DEFAULT_LIMIT;
    return Math.min(Math.max(1, n), MAX_LIMIT);
}

// ---------------------------------------------------------------------------
// buildKpiValueQuery
// ---------------------------------------------------------------------------

/**
 * Builds a parameterized query for kpi_values with optional filters and pagination.
 * Calls the filter_kpi_values() SQL helper function.
 */
export async function buildKpiValueQuery(
    filters: QueryFilters,
    pagination: PaginationOptions = {}
): Promise<QueryBuilderResult<Record<string, unknown>>> {
    const limit = safeLimit(pagination.limit);
    const sortCol = pagination.sortBy
        ? assertSortField(pagination.sortBy, KPI_VALUE_SORT_FIELDS)
        : "period_start";
    const sortDir = safeDirection(pagination.sortDirection);

    // We delegate to our SQL helper function which enforces the WHERE logic
    // and preserves RLS — the only parameterized values are the filter inputs.
    const params: unknown[] = [
        filters.kpiId ?? null,
        filters.schoolId ?? null,
        filters.periodStart ?? null,
        filters.periodEnd ?? null,
    ];

    let cursorClause = "";
    const decoded = pagination.cursor ? decodeCursor(pagination.cursor) : null;
    if (decoded) {
        // Keyset pagination: (sort_col, id) > (prev_sort_col, prev_id)
        // We push the cursor values as additional params
        params.push(decoded.t, decoded.id);
        const p1 = params.length - 1;
        const p2 = params.length;
        cursorClause =
            sortDir === "ASC"
                ? `AND (kv.${sortCol} > $${p1}::timestamptz OR (kv.${sortCol} = $${p1}::timestamptz AND kv.id > $${p2}::uuid))`
                : `AND (kv.${sortCol} < $${p1}::timestamptz OR (kv.${sortCol} = $${p1}::timestamptz AND kv.id < $${p2}::uuid))`;
    }

    const offsetClause =
        !pagination.cursor && pagination.page
            ? `OFFSET ${safeLimit(limit) * pagination.page}`
            : "";

    params.push(limit + 1); // fetch one extra to determine hasNextPage
    const limitParam = `$${params.length}`;

    const sql = `
    SELECT kv.*
    FROM   public.filter_kpi_values($1::uuid, $2::uuid, $3::date, $4::date) AS kv
    WHERE  TRUE
    ${cursorClause}
    ORDER  BY kv.${sortCol} ${sortDir}, kv.id ${sortDir}
    LIMIT  ${limitParam}
    ${offsetClause}
  `;

    const result: QueryResult = await pool.query(sql, params);
    const hasNextPage = result.rows.length > limit;
    const rows = hasNextPage ? result.rows.slice(0, limit) : result.rows;

    const lastRow = rows[rows.length - 1];
    const nextCursor =
        hasNextPage && lastRow
            ? encodeCursor(
                String(lastRow["id"]),
                String(lastRow[sortCol])
            )
            : null;

    return { rows, pageInfo: { hasNextPage, nextCursor } };
}

// ---------------------------------------------------------------------------
// buildAggregateQuery
// ---------------------------------------------------------------------------

/**
 * Builds a parameterized query for school_aggregates.
 */
export async function buildAggregateQuery(
    filters: QueryFilters,
    pagination: PaginationOptions = {}
): Promise<QueryBuilderResult<Record<string, unknown>>> {
    const limit = safeLimit(pagination.limit);
    const sortCol = pagination.sortBy
        ? assertSortField(pagination.sortBy, AGGREGATE_SORT_FIELDS)
        : "date";
    const sortDir = safeDirection(pagination.sortDirection);

    const params: unknown[] = [
        filters.schoolId ?? null,
        filters.dateFrom ?? null,
        filters.dateTo ?? null,
    ];

    let cursorClause = "";
    const decoded = pagination.cursor ? decodeCursor(pagination.cursor) : null;
    if (decoded) {
        params.push(decoded.t, decoded.id);
        const p1 = params.length - 1;
        const p2 = params.length;
        cursorClause =
            sortDir === "ASC"
                ? `AND (sa.${sortCol} > $${p1}::date OR (sa.${sortCol} = $${p1}::date AND sa.id > $${p2}::uuid))`
                : `AND (sa.${sortCol} < $${p1}::date OR (sa.${sortCol} = $${p1}::date AND sa.id < $${p2}::uuid))`;
    }

    const offsetClause =
        !pagination.cursor && pagination.page
            ? `OFFSET ${limit * pagination.page}`
            : "";

    params.push(limit + 1);
    const limitParam = `$${params.length}`;

    const sql = `
    SELECT sa.*
    FROM   public.filter_school_aggregates($1::uuid, $2::date, $3::date) AS sa
    WHERE  TRUE
    ${cursorClause}
    ORDER  BY sa.${sortCol} ${sortDir}, sa.id ${sortDir}
    LIMIT  ${limitParam}
    ${offsetClause}
  `;

    const result: QueryResult = await pool.query(sql, params);
    const hasNextPage = result.rows.length > limit;
    const rows = hasNextPage ? result.rows.slice(0, limit) : result.rows;

    const lastRow = rows[rows.length - 1];
    const nextCursor =
        hasNextPage && lastRow
            ? encodeCursor(String(lastRow["id"]), String(lastRow[sortCol]))
            : null;

    return { rows, pageInfo: { hasNextPage, nextCursor } };
}

// ---------------------------------------------------------------------------
// buildComparisonQuery
// ---------------------------------------------------------------------------

/**
 * Builds a parameterized query for school_comparison.
 */
export async function buildComparisonQuery(
    filters: QueryFilters,
    pagination: PaginationOptions = {}
): Promise<QueryBuilderResult<Record<string, unknown>>> {
    const limit = safeLimit(pagination.limit);
    const sortCol = pagination.sortBy
        ? assertSortField(pagination.sortBy, COMPARISON_SORT_FIELDS)
        : "rank";
    const sortDir = safeDirection(pagination.sortDirection);

    const params: unknown[] = [
        filters.metricKey ?? null,
        filters.schoolId ?? null,
        filters.dateFrom ?? null,
        filters.dateTo ?? null,
    ];

    let cursorClause = "";
    const decoded = pagination.cursor ? decodeCursor(pagination.cursor) : null;
    if (decoded) {
        params.push(decoded.t, decoded.id);
        const p1 = params.length - 1;
        const p2 = params.length;
        // rank is integer — cast accordingly
        cursorClause =
            sortDir === "ASC"
                ? `AND (sc.${sortCol} > $${p1}::int OR (sc.${sortCol} = $${p1}::int AND sc.id > $${p2}::uuid))`
                : `AND (sc.${sortCol} < $${p1}::int OR (sc.${sortCol} = $${p1}::int AND sc.id < $${p2}::uuid))`;
    }

    params.push(limit + 1);
    const limitParam = `$${params.length}`;

    const offsetClause =
        !pagination.cursor && pagination.page
            ? `OFFSET ${limit * pagination.page}`
            : "";

    const sql = `
    SELECT sc.*
    FROM   public.filter_school_comparison($1::varchar, $2::uuid, $3::date, $4::date) AS sc
    WHERE  TRUE
    ${cursorClause}
    ORDER  BY sc.${sortCol} ${sortDir}, sc.id ${sortDir}
    LIMIT  ${limitParam}
    ${offsetClause}
  `;

    const result: QueryResult = await pool.query(sql, params);
    const hasNextPage = result.rows.length > limit;
    const rows = hasNextPage ? result.rows.slice(0, limit) : result.rows;

    const lastRow = rows[rows.length - 1];
    const nextCursor =
        hasNextPage && lastRow
            ? encodeCursor(String(lastRow["id"]), String(lastRow[sortCol]))
            : null;

    return { rows, pageInfo: { hasNextPage, nextCursor } };
}

// ---------------------------------------------------------------------------
// validateFilters — parse and sanitize an untrusted filter object from req.query
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuid(v: unknown): v is string {
    return typeof v === "string" && UUID_RE.test(v);
}

function isDateStr(v: unknown): v is string {
    return typeof v === "string" && DATE_RE.test(v);
}

/**
 * Parses and validates filter values from client input.
 * Returns a safe QueryFilters object with only valid, typed values.
 * Unknown / invalid values are silently dropped.
 */
export function validateFilters(raw: Record<string, unknown>): QueryFilters {
    const filters: QueryFilters = {};

    if (isUuid(raw.kpiId)) filters.kpiId = raw.kpiId;
    if (isUuid(raw.schoolId)) filters.schoolId = raw.schoolId;
    if (isUuid(raw.sellerId)) filters.sellerId = raw.sellerId;

    if (typeof raw.metricKey === "string" && /^[a-z0-9_]{1,100}$/.test(raw.metricKey)) {
        filters.metricKey = raw.metricKey;
    }

    if (isDateStr(raw.periodStart)) filters.periodStart = raw.periodStart;
    if (isDateStr(raw.periodEnd)) filters.periodEnd = raw.periodEnd;
    if (isDateStr(raw.dateFrom)) filters.dateFrom = raw.dateFrom;
    if (isDateStr(raw.dateTo)) filters.dateTo = raw.dateTo;

    return filters;
}

/**
 * Parses and validates pagination options from client input.
 */
export function validatePagination(raw: Record<string, unknown>): PaginationOptions {
    const opts: PaginationOptions = {};

    const rawLimit = Number(raw.limit);
    if (!isNaN(rawLimit) && rawLimit > 0) opts.limit = rawLimit;

    const rawPage = Number(raw.page);
    if (!isNaN(rawPage) && rawPage >= 0) opts.page = rawPage;

    if (typeof raw.cursor === "string" && raw.cursor.length > 0) {
        opts.cursor = raw.cursor;
    }

    if (typeof raw.sortDirection === "string") {
        opts.sortDirection = safeDirection(raw.sortDirection);
    }

    // sortBy is validated against a whitelist inside each buildXxxQuery call
    if (typeof raw.sortBy === "string" && /^[a-z_]{1,50}$/.test(raw.sortBy)) {
        opts.sortBy = raw.sortBy;
    }

    return opts;
}
