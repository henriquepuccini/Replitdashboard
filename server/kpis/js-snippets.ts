import type { Pool } from "pg";

export interface SnippetContext {
  pool: Pool;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  schoolId: string | null;
}

export interface SnippetResult {
  value: number;
  metadata?: Record<string, unknown>;
}

type SnippetFn = (ctx: SnippetContext) => Promise<SnippetResult>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Appends a parameterised school filter to params and returns the SQL clause. */
function schoolClause(
  schoolId: string | null,
  params: unknown[],
  column = "school_id"
): string {
  if (!schoolId) return "";
  params.push(schoolId);
  return `AND ${column} = $${params.length}`;
}

/** Sum of manual_inputs.valor for a given chave_metrica within the period. */
async function manualSum(
  pool: Pool,
  chaveMetrica: string,
  periodStart: string,
  periodEnd: string,
  schoolId: string | null
): Promise<number> {
  const params: unknown[] = [chaveMetrica, periodStart, periodEnd];
  let sf: string;
  if (schoolId) {
    params.push(schoolId);
    sf = `AND school_id = $${params.length}::uuid`;
  } else {
    sf = "AND school_id IS NULL";
  }
  const r = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(valor), 0)::text AS total
     FROM public.manual_inputs
     WHERE chave_metrica = $1
       AND data_referencia >= $2::date
       AND data_referencia <= $3::date
       ${sf}`,
    params
  );
  return parseFloat(r.rows[0]?.total ?? "0");
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const snippetRegistry: Record<string, { description: string; fn: SnippetFn }> =
{
  // ── Existing snippets ──────────────────────────────────────────────────────
  new_enrollments: {
    description: "Conta novas matrículas no período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      return { value: result.rows[0]?.total ?? 0 };
    },
  },

  total_revenue: {
    description:
      "Soma receita total no período a partir de payments.payload->amount",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT COALESCE(SUM((payload->>'amount')::numeric), 0) AS total
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      return { value: parseFloat(result.rows[0]?.total ?? "0") };
    },
  },

  new_leads: {
    description: "Conta novos leads no período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM leads
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      return { value: result.rows[0]?.total ?? 0 };
    },
  },

  lead_conversion_rate: {
    description: "Taxa de conversão: matrículas / leads no período (%)",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const leadsResult = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM leads
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      const enrollResult = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      const leads = leadsResult.rows[0]?.total ?? 0;
      const enrollments = enrollResult.rows[0]?.total ?? 0;
      const rate = leads > 0 ? (enrollments / leads) * 100 : 0;
      return {
        value: Math.round(rate * 100) / 100,
        metadata: { leads, enrollments },
      };
    },
  },

  avg_ticket: {
    description:
      "Ticket médio: receita total / número de pagamentos no período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT
             COALESCE(AVG((payload->>'amount')::numeric), 0) AS avg_val,
             COUNT(*)::int AS count
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.avg_val ?? "0"),
        metadata: { paymentCount: result.rows[0]?.count ?? 0 },
      };
    },
  },

  // ── CEO Dashboard snippets ─────────────────────────────────────────────────

  /**
   * Total de Alunos Ativos
   * COUNT(DISTINCT payload->>'student_id') where status = 'ativo'.
   * Falls back to COUNT(*) if student_id field is absent in payload.
   */
  active_students: {
    description: "Total de alunos ativos (status = 'ativo') no período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query<{
        total: string;
        distinct_students: string;
      }>(
        `SELECT
             COUNT(*)::text AS total,
             COUNT(DISTINCT NULLIF(payload->>'student_id', ''))::text AS distinct_students
           FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (payload->>'status' = 'ativo' OR payload->>'status' IS NULL)
             ${sf}`,
        params
      );
      const distinctStudents = parseInt(
        result.rows[0]?.distinct_students ?? "0",
        10
      );
      const totalRows = parseInt(result.rows[0]?.total ?? "0", 10);
      const value = distinctStudents > 0 ? distinctStudents : totalRows;
      return { value, metadata: { distinctStudents, totalRows } };
    },
  },

  /**
   * Total de Descontos Vigentes
   * SUM(payments.payload->>'discount_amount') for the period.
   */
  total_discounts: {
    description:
      "Soma total de descontos aplicados nos pagamentos do período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query<{ total: string; count: string }>(
        `SELECT
             COALESCE(SUM(NULLIF(payload->>'discount_amount','')::numeric), 0)::text AS total,
             COUNT(*)::text AS count
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (payload->>'discount_amount') IS NOT NULL
             ${sf}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: {
          paymentCount: parseInt(result.rows[0]?.count ?? "0", 10),
        },
      };
    },
  },

  /**
   * Faturamento Estimado
   * avg_ticket × active_students count for the period.
   */
  estimated_revenue: {
    description:
      "Faturamento estimado: ticket médio × total de alunos ativos",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);

      const ticketResult = await ctx.pool.query<{ avg_val: string }>(
        `SELECT COALESCE(AVG((payload->>'amount')::numeric), 0)::text AS avg_val
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );

      const studentsResult = await ctx.pool.query<{
        total: string;
        distinct_students: string;
      }>(
        `SELECT
             COUNT(*)::text AS total,
             COUNT(DISTINCT NULLIF(payload->>'student_id', ''))::text AS distinct_students
           FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (payload->>'status' = 'ativo' OR payload->>'status' IS NULL)
             ${sf}`,
        params
      );

      const avgTicket = parseFloat(ticketResult.rows[0]?.avg_val ?? "0");
      const ds = parseInt(
        studentsResult.rows[0]?.distinct_students ?? "0",
        10
      );
      const ts = parseInt(studentsResult.rows[0]?.total ?? "0", 10);
      const students = ds > 0 ? ds : ts;
      const estimated = Math.round(avgTicket * students * 100) / 100;
      return { value: estimated, metadata: { avgTicket, students } };
    },
  },

  /**
   * Taxa de Ocupação
   * (active_students / capacidade_turma) × 100.
   * Capacity comes from manual_inputs.chave_metrica = 'capacidade_turma'.
   */
  occupancy_rate: {
    description:
      "Taxa de ocupação: alunos ativos / capacidade total (%) — capacidade via manual_inputs",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);

      const studentsResult = await ctx.pool.query<{
        total: string;
        distinct_students: string;
      }>(
        `SELECT
             COUNT(*)::text AS total,
             COUNT(DISTINCT NULLIF(payload->>'student_id', ''))::text AS distinct_students
           FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (payload->>'status' = 'ativo' OR payload->>'status' IS NULL)
             ${sf}`,
        params
      );

      const ds = parseInt(
        studentsResult.rows[0]?.distinct_students ?? "0",
        10
      );
      const ts = parseInt(studentsResult.rows[0]?.total ?? "0", 10);
      const students = ds > 0 ? ds : ts;

      const capacity = await manualSum(
        ctx.pool,
        "capacidade_turma",
        ctx.periodStart,
        ctx.periodEnd,
        ctx.schoolId
      );

      const rate = capacity > 0 ? (students / capacity) * 100 : 0;
      return {
        value: Math.round(rate * 100) / 100,
        metadata: { students, capacity, ratePct: rate },
      };
    },
  },

  /**
   * Margem de Contribuição
   * (revenue - custo_marketing) / revenue × 100.
   * Variable costs from manual_inputs.chave_metrica = 'custo_marketing'.
   */
  contribution_margin: {
    description:
      "Margem de contribuição: (receita - custo_marketing) / receita × 100",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);

      const revenueResult = await ctx.pool.query<{ total: string }>(
        `SELECT COALESCE(SUM((payload->>'amount')::numeric), 0)::text AS total
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      const revenue = parseFloat(revenueResult.rows[0]?.total ?? "0");

      const variableCosts = await manualSum(
        ctx.pool,
        "custo_marketing",
        ctx.periodStart,
        ctx.periodEnd,
        ctx.schoolId
      );

      const margin =
        revenue > 0 ? ((revenue - variableCosts) / revenue) * 100 : 0;
      return {
        value: Math.round(margin * 100) / 100,
        metadata: { revenue, variableCosts, marginPct: margin },
      };
    },
  },

  /**
   * LTV / CAC Ratio
   * Reads pre-computed kpi_values rows for KPI keys 'ltv' and 'cac'.
   * Returns 0 with a warning metadata if either value is missing.
   */
  ltv_cac_ratio: {
    description:
      "Relação LTV/CAC: busca valores pré-computados dos KPIs 'ltv' e 'cac'",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND kv.school_id = $${params.length}::uuid`)
        : "AND kv.school_id IS NULL";

      const result = await ctx.pool.query<{
        kpi_key: string;
        value: string;
      }>(
        `SELECT kd.key AS kpi_key, kv.value
           FROM kpi_values kv
           JOIN kpi_definitions kd ON kd.id = kv.kpi_id
           WHERE kd.key IN ('ltv', 'cac')
             AND kv.period_start = $1::date
             AND kv.period_end = $2::date
             ${sf}
           ORDER BY kd.key`,
        params
      );

      const map: Record<string, number> = {};
      for (const row of result.rows) {
        map[row.kpi_key] = parseFloat(row.value);
      }

      const ltv = map["ltv"] ?? null;
      const cac = map["cac"] ?? null;

      if (ltv === null || cac === null || cac === 0) {
        return {
          value: 0,
          metadata: {
            ltv,
            cac,
            warning:
              ltv === null
                ? "KPI 'ltv' não computado para este período"
                : cac === null
                  ? "KPI 'cac' não computado para este período"
                  : "CAC é zero, divisão impossível",
          },
        };
      }

      return {
        value: Math.round((ltv / cac) * 100) / 100,
        metadata: { ltv, cac },
      };
    },
  },
}; // end snippetRegistry — CEO snippets above, Coordinator/Seller below appended here

// ─── Coordinator & Seller snippets ────────────────────────────────────────────

// Add to registry dynamically so the const above stays type-safe
Object.assign(snippetRegistry, {
  /**
   * DSO – Taxa de Inadimplência
   * SUM(amount_due WHERE status IN ('open','overdue')) / revenue × days_in_period.
   * Returns 0 with a "no_data" warning when contas_a_receber is empty.
   */
  dso: {
    description:
      "Taxa de inadimplência (DSO): contas a receber em aberto / faturamento × dias do período",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      // Outstanding receivables (open + overdue, whose due_date falls in period)
      const arResult = await ctx.pool.query<{ ar_total: string; count: string }>(
        `SELECT
           COALESCE(SUM(amount_due), 0)::text AS ar_total,
           COUNT(*)::text AS count
         FROM public.contas_a_receber
         WHERE status IN ('open', 'overdue')
           AND due_date >= $1::date
           AND due_date <= $2::date
           ${schoolFilter}`,
        params
      );

      const arTotal = parseFloat(arResult.rows[0]?.ar_total ?? "0");
      const arCount = parseInt(arResult.rows[0]?.count ?? "0", 10);

      if (arCount === 0) {
        return {
          value: 0,
          metadata: { warning: "contas_a_receber vazia — populate via financial connector" },
        };
      }

      // Revenue from payments in period
      const revParams: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const revSf = ctx.schoolId
        ? (revParams.push(ctx.schoolId), `AND school_id = $${revParams.length}::uuid`)
        : "";
      const revResult = await ctx.pool.query<{ total: string }>(
        `SELECT COALESCE(SUM((payload->>'amount')::numeric), 0)::text AS total
         FROM payments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${revSf}`,
        revParams
      );
      const revenue = parseFloat(revResult.rows[0]?.total ?? "0");

      // Days in period
      const start = new Date(ctx.periodStart);
      const end = new Date(ctx.periodEnd);
      const daysInPeriod =
        Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

      const dso = revenue > 0 ? (arTotal / revenue) * daysInPeriod : 0;
      return {
        value: Math.round(dso * 100) / 100,
        metadata: { arTotal, revenue, daysInPeriod },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * NPS Score
   * (% promoters - % detractors) computed from nps_surveys.
   * Promoter: score >= 9; Passive: 7-8; Detractor: score <= 6.
   */
  nps_score: {
    description: "NPS: % promotores (score ≥ 9) - % detratores (score ≤ 6), via nps_surveys",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{
        total: string;
        promoters: string;
        passives: string;
        detractors: string;
      }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE score >= 9)::text AS promoters,
           COUNT(*) FILTER (WHERE score BETWEEN 7 AND 8)::text AS passives,
           COUNT(*) FILTER (WHERE score <= 6)::text AS detractors
         FROM public.nps_surveys
         WHERE survey_date >= $1::date
           AND survey_date <= $2::date
           ${schoolFilter}`,
        params
      );

      const total = parseInt(result.rows[0]?.total ?? "0", 10);
      if (total === 0) {
        return {
          value: 0,
          metadata: { warning: "Nenhuma resposta NPS no período", total },
        };
      }
      const promoters = parseInt(result.rows[0]?.promoters ?? "0", 10);
      const passives = parseInt(result.rows[0]?.passives ?? "0", 10);
      const detractors = parseInt(result.rows[0]?.detractors ?? "0", 10);

      const score =
        Math.round(((promoters - detractors) / total) * 100 * 100) / 100;
      return {
        value: score,
        metadata: { total, promoters, passives, detractors },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Tempo Médio por Estágio
   * Average hours between stage-change events in leads_history.
   * Requires changedFields @> ARRAY['stage'] entries.
   */
  avg_stage_time: {
    description:
      "Tempo médio entre mudanças de estágio dos leads (horas), via leads_history",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      // Stage changes are rows in leads_history where 'stage' is in changedFields
      // We compute the average gap (in hours) between consecutive stage events per lead
      // To scope by school we join to leads table.
      const schoolJoin = ctx.schoolId
        ? `JOIN public.leads l ON l.id = lh.lead_id AND l.school_id = $3::uuid`
        : "";
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const result = await ctx.pool.query<{ avg_hours: string; transitions: string }>(
        `WITH stage_events AS (
           SELECT
             lh.lead_id,
             lh.created_at,
             LAG(lh.created_at) OVER (PARTITION BY lh.lead_id ORDER BY lh.created_at) AS prev_at
           FROM public.leads_history lh
           ${schoolJoin}
           WHERE lh.created_at >= $1::timestamptz
             AND lh.created_at < $2::timestamptz
             AND lh.changed_fields @> ARRAY['stage']
         ),
         transitions AS (
           SELECT
             EXTRACT(EPOCH FROM (created_at - prev_at)) / 3600.0 AS hours
           FROM stage_events
           WHERE prev_at IS NOT NULL
         )
         SELECT
           COALESCE(AVG(hours), 0)::text AS avg_hours,
           COUNT(*)::text AS transitions
         FROM transitions`,
        params
      );

      const avgHours = parseFloat(result.rows[0]?.avg_hours ?? "0");
      const transitions = parseInt(result.rows[0]?.transitions ?? "0", 10);

      if (transitions === 0) {
        return {
          value: 0,
          metadata: {
            warning: "Nenhuma mudança de estágio registrada no período",
            transitions,
          },
        };
      }
      return {
        value: Math.round(avgHours * 100) / 100,
        metadata: { avgHours, transitions },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Retention Rate
   * reads churn_rate from network_aggregates.metrics JSONB, returns (1 - churn) × 100.
   * If school_id is given, reads from school_comparison for that school + metric_key='churn_rate'.
   */
  retention_rate: {
    description:
      "Taxa de retenção: (1 - churn_rate) × 100, derivada dos dados de churn existentes",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      let churnRate: number | null = null;

      if (ctx.schoolId) {
        // Per-school: read from school_comparison table
        const result = await ctx.pool.query<{ metric_value: string }>(
          `SELECT metric_value::text
           FROM public.school_comparison
           WHERE school_id = $1::uuid
             AND metric_key = 'churn_rate'
             AND date >= $2::date
             AND date <= $3::date
           ORDER BY date DESC
           LIMIT 1`,
          [ctx.schoolId, ctx.periodStart, ctx.periodEnd]
        );
        if (result.rows[0]) {
          churnRate = parseFloat(result.rows[0].metric_value);
        }
      } else {
        // Network-wide: read from network_aggregates JSONB
        const result = await ctx.pool.query<{ churn: string }>(
          `SELECT (metrics->>'churn_rate')::text AS churn
           FROM public.network_aggregates
           WHERE date >= $1::date AND date <= $2::date
           ORDER BY date DESC
           LIMIT 1`,
          [ctx.periodStart, ctx.periodEnd]
        );
        if (result.rows[0]?.churn) {
          churnRate = parseFloat(result.rows[0].churn);
        }
      }

      if (churnRate === null || isNaN(churnRate)) {
        return {
          value: 0,
          metadata: { warning: "Churn ainda não calculado para este período" },
        };
      }

      // churn_rate is stored as a decimal (e.g. 0.08 = 8%)
      // retention = (1 - churn) × 100
      const retention = Math.round((1 - churnRate) * 100 * 100) / 100;
      return {
        value: retention,
        metadata: { churnRate, retentionPct: retention },
      };
    },
  } satisfies { description: string; fn: SnippetFn },
});

export function getSnippet(key: string) {
  return snippetRegistry[key];
}

export function listSnippets() {
  return Object.entries(snippetRegistry).map(([key, { description }]) => ({
    key,
    description,
  }));
}
