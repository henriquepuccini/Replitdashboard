import { pool } from "../db";
import { storage } from "../storage";
import { getSnippet } from "./js-snippets";
import type { KpiDefinition, KpiCalcRun, KpiValue } from "@shared/schema";

export interface ComputeKpiParams {
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  schoolId?: string | null;
  userId?: string | null;
  version?: string;
}

export interface ComputeKpiResult {
  calcRun: KpiCalcRun;
  kpiValue: KpiValue;
  definition: KpiDefinition;
  computedValue: number;
  lockAcquired: boolean;
}

export interface BatchComputeResult {
  kpiId: string;
  kpiKey: string;
  results: Array<{
    schoolId: string | null;
    success: boolean;
    result?: ComputeKpiResult;
    error?: string;
  }>;
}

async function tryAcquireLock(
  client: import("pg").PoolClient,
  kpiId: string,
  periodStart: string,
  periodEnd: string,
  schoolId: string | null
): Promise<boolean> {
  const result = await client.query(
    `SELECT public.try_kpi_lock($1::uuid, $2::date, $3::date, $4::uuid) AS locked`,
    [kpiId, periodStart, periodEnd, schoolId]
  );
  return result.rows[0]?.locked === true;
}

async function executeSqlCalc(
  client: import("pg").PoolClient,
  kpiId: string,
  periodStart: string,
  periodEnd: string,
  schoolId: string | null
): Promise<number> {
  const result = await client.query(
    `SELECT public.compute_kpi_sql($1::uuid, $2::date, $3::date, $4::uuid) AS value`,
    [kpiId, periodStart, periodEnd, schoolId]
  );
  return parseFloat(result.rows[0]?.value ?? "0");
}

async function executeJsCalc(
  definition: KpiDefinition,
  periodStart: string,
  periodEnd: string,
  schoolId: string | null
): Promise<{ value: number; metadata?: Record<string, unknown> }> {
  const config = definition.config as Record<string, unknown>;
  const snippetKey = (config?.js_snippet as string) || definition.key;

  const snippet = getSnippet(snippetKey);
  if (!snippet) {
    throw new Error(
      `JS snippet '${snippetKey}' não encontrado no registro de snippets aprovados`
    );
  }

  return snippet.fn({
    pool,
    kpiId: definition.id,
    periodStart,
    periodEnd,
    schoolId,
  });
}

export async function computeKpi(
  params: ComputeKpiParams
): Promise<ComputeKpiResult> {
  const { kpiId, periodStart, periodEnd, schoolId = null, userId = null, version } = params;

  const definition = await storage.getKpiDefinition(kpiId);
  if (!definition) {
    throw new Error(`Definição de KPI não encontrada: ${kpiId}`);
  }
  if (!definition.isActive) {
    throw new Error(`KPI '${definition.key}' está inativo`);
  }

  const calcVersion = version || `v${Date.now()}`;
  const inputSnapshot: Record<string, unknown> = {
    kpiId,
    kpiKey: definition.key,
    calcType: definition.calcType,
    periodStart,
    periodEnd,
    schoolId,
    version: calcVersion,
    config: definition.config,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const locked = await tryAcquireLock(client, kpiId, periodStart, periodEnd, schoolId);
    if (!locked) {
      await client.query("ROLLBACK");
      throw new Error(
        `Cálculo concorrente em andamento para KPI ${definition.key} ` +
        `período ${periodStart}..${periodEnd} escola ${schoolId || 'rede'}`
      );
    }

    const [calcRunRow] = (
      await client.query(
        `INSERT INTO kpi_calc_runs (kpi_id, status, inputs, version, created_by, started_at)
         VALUES ($1, 'running', $2, $3, $4, NOW())
         RETURNING *`,
        [kpiId, JSON.stringify(inputSnapshot), calcVersion, userId]
      )
    ).rows;

    let computedValue: number;
    let resultMetadata: Record<string, unknown> = {};

    try {
      if (definition.calcType === "sql") {
        computedValue = await executeSqlCalc(client, kpiId, periodStart, periodEnd, schoolId);
      } else if (definition.calcType === "js") {
        const jsResult = await executeJsCalc(definition, periodStart, periodEnd, schoolId);
        computedValue = jsResult.value;
        resultMetadata = jsResult.metadata || {};
      } else if (definition.calcType === "materialized") {
        computedValue = await executeSqlCalc(client, kpiId, periodStart, periodEnd, schoolId);
      } else {
        throw new Error(`Tipo de cálculo não suportado: ${definition.calcType}`);
      }
    } catch (calcError) {
      await client.query(
        `UPDATE kpi_calc_runs SET status = 'failed', finished_at = NOW()
         WHERE id = $1`,
        [calcRunRow.id]
      );

      const errorSnapshot = {
        error: calcError instanceof Error ? calcError.message : String(calcError),
        stack: calcError instanceof Error ? calcError.stack : undefined,
      };

      await client.query(
        `INSERT INTO calculation_audit (calc_run_id, input_snapshot, result_snapshot)
         VALUES ($1, $2, $3)`,
        [calcRunRow.id, JSON.stringify(inputSnapshot), JSON.stringify(errorSnapshot)]
      );

      await client.query("COMMIT");
      throw calcError;
    }

    const [kpiValueRow] = (
      await client.query(
        `INSERT INTO kpi_values (kpi_id, school_id, period_start, period_end, value, computed_at, calc_run_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         RETURNING *`,
        [kpiId, schoolId, periodStart, periodEnd, computedValue.toString(), calcRunRow.id]
      )
    ).rows;

    await client.query(
      `UPDATE kpi_calc_runs SET status = 'success', finished_at = NOW()
       WHERE id = $1`,
      [calcRunRow.id]
    );

    const resultSnapshot: Record<string, unknown> = {
      computedValue,
      kpiValueId: kpiValueRow.id,
      ...resultMetadata,
    };

    await client.query(
      `INSERT INTO calculation_audit (calc_run_id, input_snapshot, result_snapshot)
       VALUES ($1, $2, $3)`,
      [calcRunRow.id, JSON.stringify(inputSnapshot), JSON.stringify(resultSnapshot)]
    );

    await client.query("COMMIT");

    const calcRun = await storage.getKpiCalcRun(calcRunRow.id);
    const kpiValue = kpiValueRow as KpiValue;

    return {
      calcRun: calcRun!,
      kpiValue,
      definition,
      computedValue,
      lockAcquired: true,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

export async function computeKpiForAllSchools(
  kpiId: string,
  periodStart: string,
  periodEnd: string,
  userId?: string | null,
  version?: string,
  concurrency: number = 3
): Promise<BatchComputeResult> {
  const definition = await storage.getKpiDefinition(kpiId);
  if (!definition) {
    throw new Error(`Definição de KPI não encontrada: ${kpiId}`);
  }

  const allSchools = await storage.getSchools();

  const targets: Array<{ schoolId: string | null; label: string }> = [
    { schoolId: null, label: "rede" },
    ...allSchools.map((s) => ({ schoolId: s.id, label: s.name })),
  ];

  const results: BatchComputeResult["results"] = [];

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((target) =>
        computeKpi({
          kpiId,
          periodStart,
          periodEnd,
          schoolId: target.schoolId,
          userId,
          version,
        })
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const outcome = batchResults[j];
      const target = batch[j];
      if (outcome.status === "fulfilled") {
        results.push({
          schoolId: target.schoolId,
          success: true,
          result: outcome.value,
        });
      } else {
        results.push({
          schoolId: target.schoolId,
          success: false,
          error: outcome.reason?.message || String(outcome.reason),
        });
      }
    }
  }

  return {
    kpiId,
    kpiKey: definition.key,
    results,
  };
}

export async function computeRollup(
  kpiId: string,
  periodStart: string,
  periodEnd: string,
  subPeriods: Array<{ start: string; end: string }>,
  schoolId: string | null = null,
  userId: string | null = null,
  aggregation: "sum" | "avg" = "sum"
): Promise<ComputeKpiResult> {
  const definition = await storage.getKpiDefinition(kpiId);
  if (!definition) {
    throw new Error(`Definição de KPI não encontrada: ${kpiId}`);
  }

  const existingValues = await storage.getKpiValues(kpiId, schoolId, 1000);
  const existingPeriods = new Set(
    existingValues.map((v) => `${v.periodStart}|${v.periodEnd}`)
  );

  const missingPeriods = subPeriods.filter(
    (sp) => !existingPeriods.has(`${sp.start}|${sp.end}`)
  );

  for (const sp of missingPeriods) {
    await computeKpi({
      kpiId,
      periodStart: sp.start,
      periodEnd: sp.end,
      schoolId,
      userId,
    });
  }

  const allValues = await storage.getKpiValues(kpiId, schoolId, 1000);
  const periodValues = allValues
    .filter((v) => {
      const vStart = String(v.periodStart);
      const vEnd = String(v.periodEnd);
      return subPeriods.some((sp) => sp.start === vStart && sp.end === vEnd);
    })
    .map((v) => parseFloat(v.value));

  let rollupValue: number;
  if (aggregation === "sum") {
    rollupValue = periodValues.reduce((sum, v) => sum + v, 0);
  } else {
    rollupValue = periodValues.length > 0
      ? periodValues.reduce((sum, v) => sum + v, 0) / periodValues.length
      : 0;
  }

  return computeKpi({
    kpiId,
    periodStart,
    periodEnd,
    schoolId,
    userId,
    version: `rollup_${aggregation}_${Date.now()}`,
  });
}
