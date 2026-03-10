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

/** 
 * Gets combined operational and legal capacity across all turmas for a given school/network 
 * using the latest effective_from date <= periodEnd.
 */
async function getCapacities(
  pool: Pool,
  periodEnd: string,
  schoolId: string | null
): Promise<{ operational: number; legal: number } | null> {
  const params: unknown[] = [periodEnd];
  const sf = schoolId
    ? (params.push(schoolId), `AND school_id = $2::uuid`)
    : "AND school_id IS NULL";

  const result = await pool.query<{ count: string; op_total: string; leg_total: string }>(
    `WITH latest AS (
       SELECT DISTINCT ON (COALESCE(turma, '')) 
         operational_capacity, 
         legal_capacity
       FROM public.school_capacity
       WHERE effective_from <= $1::date
         ${sf}
       ORDER BY COALESCE(turma, ''), effective_from DESC
     )
     SELECT 
       COUNT(*)::text AS count,
       COALESCE(SUM(operational_capacity), 0)::text AS op_total,
       COALESCE(SUM(legal_capacity), 0)::text AS leg_total
     FROM latest`,
    params
  );

  if (parseInt(result.rows[0]?.count ?? "0", 10) === 0) {
    return null;
  }
  return {
    operational: parseFloat(result.rows[0]?.op_total ?? "0"),
    legal: parseFloat(result.rows[0]?.leg_total ?? "0"),
  };
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
      "Soma receita total bruta no período a partir de payments.gross_value",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT COALESCE(SUM(gross_value), 0) AS total
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz ${sf}`,
        params
      );
      return { value: parseFloat(result.rows[0]?.total ?? "0") };
    },
  },

  /**
   * Receita Líquida
   * SUM(net_value) from structured payments columns for the period.
   * More precise than reading from the JSONB payload blob.
   */
  net_revenue: {
    description:
      "Receita líquida: soma de net_value (gross − bolsa − desconto comercial) no período",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query<{
        net: string;
        gross: string;
        scholarship: string;
        commercial: string;
        count: string;
      }>(
        `SELECT
           COALESCE(SUM(net_value), 0)::text            AS net,
           COALESCE(SUM(gross_value), 0)::text          AS gross,
           COALESCE(SUM(scholarship_discount), 0)::text AS scholarship,
           COALESCE(SUM(commercial_discount), 0)::text  AS commercial,
           COUNT(*)::text                               AS count
         FROM public.payments
         WHERE created_at >= $1::timestamptz
           AND created_at <  $2::timestamptz
           ${sf}`,
        params
      );
      const net = parseFloat(result.rows[0]?.net ?? "0");
      const gross = parseFloat(result.rows[0]?.gross ?? "0");
      const scholarship = parseFloat(result.rows[0]?.scholarship ?? "0");
      const commercial = parseFloat(result.rows[0]?.commercial ?? "0");
      const count = parseInt(result.rows[0]?.count ?? "0", 10);
      return {
        value: net,
        metadata: { gross, scholarshipDiscount: scholarship, commercialDiscount: commercial, paymentCount: count },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

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
      "Ticket médio: receita bruta / número de pagamentos no período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query(
        `SELECT
             COALESCE(AVG(gross_value), 0) AS avg_val,
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
      "Soma total de descontos (bolsa + comercial) nos pagamentos do período",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);
      const result = await ctx.pool.query<{ total: string; count: string }>(
        `SELECT
             COALESCE(SUM(scholarship_discount + commercial_discount), 0)::text AS total,
             COUNT(*)::text AS count
           FROM payments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (scholarship_discount > 0 OR commercial_discount > 0)
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
        `SELECT COALESCE(AVG(gross_value), 0)::text AS avg_val
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
   * Taxa de Ocupação (Real / Genérica)
   * (active_students / operational_capacity) × 100.
   * Prioritizes school_capacity table over manual_inputs.
   */
  occupancy_rate: {
    description:
      "Taxa de ocupação: alunos ativos / capacidade real (%) — prioriza school_capacity (operacional), fallback manual_inputs",
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

      const caps = await getCapacities(ctx.pool, ctx.periodEnd, ctx.schoolId);

      let capacity = caps?.operational;
      let usingFallback = false;

      if (capacity === undefined || capacity === null) {
        usingFallback = true;
        capacity = await manualSum(
          ctx.pool,
          "capacidade_turma",
          ctx.periodStart,
          ctx.periodEnd,
          ctx.schoolId
        );
      }

      const rate = capacity > 0 ? (students / capacity) * 100 : 0;
      return {
        value: Math.round(rate * 100) / 100,
        metadata: { students, capacity, ratePct: rate, usingFallback },
      };
    },
  },

  /**
   * Taxa de Ocupação Operacional (Strict)
   * (active_students / operational_capacity) × 100.
   */
  operational_occupancy_rate: {
    description:
      "Taxa de ocupação operacional: alunos ativos / capacidade operacional (%) — apenas school_capacity",
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

      const caps = await getCapacities(ctx.pool, ctx.periodEnd, ctx.schoolId);

      if (!caps || caps.operational === 0) {
        return {
          value: 0,
          metadata: { warning: "Capacidade operacional não informada via school_capacity", students },
        };
      }

      const rate = (students / caps.operational) * 100;
      const safetyMarginPct = caps.legal > 0 ? ((caps.legal - caps.operational) / caps.legal) * 100 : 0;

      return {
        value: Math.round(rate * 100) / 100,
        metadata: { students, capacity: caps.operational, ratePct: rate, safetyMarginPct },
      };
    },
  },

  /**
   * Taxa de Ocupação Legal
   * (active_students / legal_capacity) × 100.
   */
  legal_occupancy_rate: {
    description:
      "Taxa de ocupação legal: alunos ativos / capacidade legal (edital) (%) — requer school_capacity",
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

      const caps = await getCapacities(ctx.pool, ctx.periodEnd, ctx.schoolId);

      if (!caps || caps.legal === 0) {
        return {
          value: 0,
          metadata: { warning: "Capacidade legal não informada via school_capacity", students },
        };
      }

      const rate = (students / caps.legal) * 100;
      return {
        value: Math.round(rate * 100) / 100,
        metadata: { students, capacity: caps.legal, ratePct: rate },
      };
    },
  },

  /**
   * Vacância por Turma
   * Detalhamento de vagas disponíveis por sala/turma.
   */
  vacancy_by_turma: {
    description: "Detalhamento de vagas por turma: capacidade operacional vs. alunos ativos",
    fn: async (ctx) => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const sf = schoolClause(ctx.schoolId, params);

      // Get students counts per turma
      const studentsResult = await ctx.pool.query<{
        turma: string;
        count: string;
      }>(
        `SELECT
             COALESCE(payload->>'turma', 'Não Informada') as turma,
             COUNT(DISTINCT NULLIF(payload->>'student_id', ''))::text AS count
           FROM enrollments
           WHERE created_at >= $1::timestamptz
             AND created_at < $2::timestamptz
             AND (payload->>'status' = 'ativo' OR payload->>'status' IS NULL)
             ${sf}
           GROUP BY COALESCE(payload->>'turma', 'Não Informada')`,
        params
      );

      const studentCounts = new Map(
        studentsResult.rows.map((r) => [r.turma, parseInt(r.count, 10)])
      );

      // Get latest capacities per turma
      const capParams: unknown[] = [ctx.periodEnd];
      const capSf = ctx.schoolId
        ? (capParams.push(ctx.schoolId), `AND school_id = $2::uuid`)
        : "AND school_id IS NULL";

      const capsResult = await ctx.pool.query<{
        turma: string;
        operational_capacity: number;
        legal_capacity: number;
      }>(
        `SELECT DISTINCT ON (COALESCE(turma, '')) 
           COALESCE(turma, 'Não Informada') as turma,
           operational_capacity, 
           legal_capacity
         FROM public.school_capacity
         WHERE effective_from <= $1::date
           ${capSf}
         ORDER BY COALESCE(turma, ''), effective_from DESC`,
        capParams
      );

      const breakdown = capsResult.rows.map((r) => {
        const students = studentCounts.get(r.turma) || 0;
        const vacancy = Math.max(0, r.operational_capacity - students);
        const isFull = vacancy === 0 && r.operational_capacity > 0;

        return {
          turma: r.turma,
          capacity: r.operational_capacity,
          legalCapacity: r.legal_capacity,
          students,
          vacancy,
          isFull,
          occupancyPct: r.operational_capacity > 0 ? (students / r.operational_capacity) * 100 : 0
        };
      });

      // Overall vacancy as the main value (sum of vacancies)
      const totalVacancy = breakdown.reduce((sum, item) => sum + item.vacancy, 0);

      return {
        value: totalVacancy,
        metadata: {
          breakdown,
          totalStudents: Array.from(studentCounts.values()).reduce((a, b) => a + b, 0),
          totalCapacity: breakdown.reduce((sum, item) => sum + item.capacity, 0)
        },
      };
    },
  },

  /**
   * Margem de Segurança
   * legal_capacity - operational_capacity
   */
  safety_margin: {
    description:
      "Margem de segurança: capacidade legal - capacidade operacional (em nº de vagas)",
    fn: async (ctx) => {
      const caps = await getCapacities(ctx.pool, ctx.periodEnd, ctx.schoolId);

      if (!caps) {
        return {
          value: 0,
          metadata: { warning: "school_capacity não configurada" },
        };
      }

      const gap = caps.legal - caps.operational;
      const gapPct = caps.legal > 0 ? (gap / caps.legal) * 100 : 0;

      return {
        value: gap,
        metadata: {
          legal_capacity: caps.legal,
          operational_capacity: caps.operational,
          safety_margin_pct: gapPct
        },
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
        `SELECT COALESCE(SUM(gross_value), 0)::text AS total
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
        `SELECT COALESCE(SUM(gross_value), 0)::text AS total
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

  // ─── Revenue Realization & Discount Granularity (migration 032) ────────────

  /**
   * Receita Bruta
   * SUM(base_value) from student_contracts for the period.
   */
  gross_revenue: {
    description: "Receita Bruta: SUM(base_value) dos contratos de alunos no período",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{ total: string; count: string }>(
        `SELECT
           COALESCE(SUM(base_value), 0)::text AS total,
           COUNT(*)::text                     AS count
         FROM public.student_contracts
         WHERE period_start >= $1::date
           AND period_end   <= $2::date
           ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: { contractCount: parseInt(result.rows[0]?.count ?? "0", 10) },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Receita Líquida
   * SUM(net_value) from payments.
   */
  net_revenue: {
    description: "Receita Líquida: Receita bruta (payments.gross_value) descontadas as bolsas e descontos",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(net_value), 0)::text AS total
         FROM public.payments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz
           ${schoolFilter}`,
        params
      );
      return { value: parseFloat(result.rows[0]?.total ?? "0") };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Leakage por Bolsas/Convênios
   * SUM(scholarship_discount) from student_contracts.
   */
  scholarship_leakage: {
    description: "Perda de receita por bolsas e convênios: SUM(scholarship_discount)",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{ total: string; count: string }>(
        `SELECT
           COALESCE(SUM(scholarship_discount), 0)::text AS total,
           COUNT(*) FILTER (WHERE scholarship_discount > 0)::text AS count
         FROM public.student_contracts
         WHERE period_start >= $1::date
           AND period_end   <= $2::date
           ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: { affectedContracts: parseInt(result.rows[0]?.count ?? "0", 10) },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Leakage Comercial
   * SUM(commercial_discount) from student_contracts (pontualidade, irmãos, negociação).
   */
  commercial_leakage: {
    description: "Perda de receita por descontos comerciais: SUM(commercial_discount)",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{ total: string; count: string }>(
        `SELECT
           COALESCE(SUM(commercial_discount), 0)::text AS total,
           COUNT(*) FILTER (WHERE commercial_discount > 0)::text AS count
         FROM public.student_contracts
         WHERE period_start >= $1::date
           AND period_end   <= $2::date
           ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: { affectedContracts: parseInt(result.rows[0]?.count ?? "0", 10) },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Taxa de Realização de Receita
   * (net_revenue / gross_revenue) × 100 — how much of gross revenue is actually collected.
   */
  revenue_realization_rate: {
    description: "Taxa de realização: receita líquida / receita bruta × 100 (%)",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{
        gross: string;
        net: string;
        scholarship: string;
        commercial: string;
      }>(
        `SELECT
           COALESCE(SUM(base_value), 0)::text           AS gross,
           COALESCE(SUM(final_value), 0)::text          AS net,
           COALESCE(SUM(scholarship_discount), 0)::text AS scholarship,
           COALESCE(SUM(commercial_discount), 0)::text  AS commercial
         FROM public.student_contracts
         WHERE period_start >= $1::date
           AND period_end   <= $2::date
           ${schoolFilter}`,
        params
      );

      const gross = parseFloat(result.rows[0]?.gross ?? "0");
      const net = parseFloat(result.rows[0]?.net ?? "0");
      const scholarship = parseFloat(result.rows[0]?.scholarship ?? "0");
      const commercial = parseFloat(result.rows[0]?.commercial ?? "0");

      if (gross <= 0) {
        return {
          value: 0,
          metadata: { warning: "Nenhum contrato encontrado no período", gross, net },
        };
      }

      const rate = Math.round((net / gross) * 100 * 100) / 100;
      return {
        value: rate,
        metadata: { gross, net, scholarship, commercial, realizationPct: rate },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Leakage Total de Desconto
   * SUM(scholarship_discount + commercial_discount) — total revenue leakage.
   * Supersedes legacy total_discounts (which reads payments.payload->>'discount_amount').
   */
  total_discount_leakage: {
    description: "Leakage total: SUM(scholarship_discount + commercial_discount) dos contratos",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = ctx.schoolId
        ? (params.push(ctx.schoolId), `AND school_id = $${params.length}::uuid`)
        : "";

      const result = await ctx.pool.query<{
        total: string;
        scholarship: string;
        commercial: string;
      }>(
        `SELECT
           COALESCE(SUM(scholarship_discount + commercial_discount), 0)::text AS total,
           COALESCE(SUM(scholarship_discount), 0)::text                       AS scholarship,
           COALESCE(SUM(commercial_discount), 0)::text                        AS commercial
         FROM public.student_contracts
         WHERE period_start >= $1::date
           AND period_end   <= $2::date
           ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: {
          scholarshipLeakage: parseFloat(result.rows[0]?.scholarship ?? "0"),
          commercialLeakage: parseFloat(result.rows[0]?.commercial ?? "0"),
        },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  // ─── Pedagogical Retention (migration 033) ────────────────────────────────

  /**
   * LTV Perdido por Cancelamentos
   * SUM(ltv_lost) from enrollments WHERE enrollment_status = 'cancelled'.
   */
  ltv_lost_by_cancellation: {
    description: "LTV perdido: SUM(ltv_lost) das matrículas canceladas no período",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = schoolClause(ctx.schoolId, params);

      const result = await ctx.pool.query<{
        total: string;
        count: string;
      }>(
        `SELECT
           COALESCE(SUM(ltv_lost), 0)::text AS total,
           COUNT(*)::text                   AS count
         FROM public.enrollments
         WHERE enrollment_status = 'cancelled'
           AND cancelled_at >= $1::date
           AND cancelled_at <= ($2::date + interval '1 day')
           ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.total ?? "0"),
        metadata: { cancelledCount: parseInt(result.rows[0]?.count ?? "0", 10) },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Taxa de Falha de Adaptação
   * % of cancelled enrollments classified as adaptation_failure.
   * Critical pedagogical metric — high values indicate onboarding issues.
   */
  adaptation_failure_rate: {
    description: "% de cancelamentos por Falha de Adaptação — métrica crítica pedagógica",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = schoolClause(ctx.schoolId, params);

      const result = await ctx.pool.query<{
        total: string;
        adaptation: string;
      }>(
        `SELECT
           COUNT(*)::text                                                    AS total,
           COUNT(*) FILTER (
             WHERE cm.code = 'adaptation_failure'
           )::text                                                           AS adaptation
         FROM public.enrollments e
         LEFT JOIN public.churn_motives cm ON cm.id = e.churn_motive_id
         WHERE e.enrollment_status = 'cancelled'
           AND e.cancelled_at >= $1::date
           AND e.cancelled_at <= ($2::date + interval '1 day')
           ${schoolFilter}`,
        params
      );

      const total = parseInt(result.rows[0]?.total ?? "0", 10);
      const adaptation = parseInt(result.rows[0]?.adaptation ?? "0", 10);

      if (total <= 0) {
        return {
          value: 0,
          metadata: { warning: "Nenhum cancelamento no período", total, adaptation },
        };
      }

      const rate = Math.round((adaptation / total) * 100 * 100) / 100;
      return {
        value: rate,
        metadata: { total, adaptation, adaptationRatePct: rate },
      };
    },
  } satisfies { description: string; fn: SnippetFn },

  /**
   * Tempo Médio de Conversão (dias)
   * Average number of calendar days between lead creation and conversion to
   * an active enrollment, for leads whose converted_at falls within the period.
   */
  avg_conversion_time: {
    description: "Tempo médio em dias do primeiro contato do lead até a conversão em matrícula",
    fn: async (ctx: SnippetContext): Promise<SnippetResult> => {
      const params: unknown[] = [ctx.periodStart, ctx.periodEnd];
      const schoolFilter = schoolClause(ctx.schoolId, params);

      const result = await ctx.pool.query<{
        avg_days: string | null;
        total_converted: string;
      }>(
        `SELECT
           AVG(
             EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400.0
           )::text                     AS avg_days,
           COUNT(*)::text              AS total_converted
         FROM public.leads
         WHERE converted_at IS NOT NULL
           AND converted_at >= $1::timestamptz
           AND converted_at <  ($2::timestamptz + interval '1 day')
           ${schoolFilter}`,
        params
      );

      const totalConverted = parseInt(result.rows[0]?.total_converted ?? "0", 10);
      const avgDays = result.rows[0]?.avg_days != null
        ? Math.round(parseFloat(result.rows[0].avg_days) * 10) / 10
        : null;

      if (totalConverted === 0 || avgDays === null) {
        return {
          value: 0,
          metadata: { warning: "Nenhuma conversão no período", totalConverted },
        };
      }

      return {
        value: avgDays,
        metadata: { totalConverted, avgDays },
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
