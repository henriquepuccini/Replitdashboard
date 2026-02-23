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

const snippetRegistry: Record<string, { description: string; fn: SnippetFn }> = {
  new_enrollments: {
    description: "Conta novas matrículas no período",
    fn: async (ctx) => {
      const schoolFilter = ctx.schoolId
        ? `AND school_id = $3`
        : "";
      const params: (string | null)[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const result = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM enrollments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
        params
      );
      return { value: result.rows[0]?.total ?? 0 };
    },
  },

  total_revenue: {
    description: "Soma receita total no período a partir de payments.payload->amount",
    fn: async (ctx) => {
      const schoolFilter = ctx.schoolId
        ? `AND school_id = $3`
        : "";
      const params: (string | null)[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const result = await ctx.pool.query(
        `SELECT COALESCE(SUM((payload->>'amount')::numeric), 0) AS total
         FROM payments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
        params
      );
      return { value: parseFloat(result.rows[0]?.total ?? "0") };
    },
  },

  new_leads: {
    description: "Conta novos leads no período",
    fn: async (ctx) => {
      const schoolFilter = ctx.schoolId
        ? `AND school_id = $3`
        : "";
      const params: (string | null)[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const result = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM leads
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
        params
      );
      return { value: result.rows[0]?.total ?? 0 };
    },
  },

  lead_conversion_rate: {
    description: "Taxa de conversão: matrículas / leads no período (%)",
    fn: async (ctx) => {
      const schoolFilter = ctx.schoolId
        ? `AND school_id = $3`
        : "";
      const params: (string | null)[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const leadsResult = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM leads
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
        params
      );
      const enrollResult = await ctx.pool.query(
        `SELECT COUNT(*)::int AS total FROM enrollments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
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
    description: "Ticket médio: receita total / número de pagamentos no período",
    fn: async (ctx) => {
      const schoolFilter = ctx.schoolId
        ? `AND school_id = $3`
        : "";
      const params: (string | null)[] = [ctx.periodStart, ctx.periodEnd];
      if (ctx.schoolId) params.push(ctx.schoolId);

      const result = await ctx.pool.query(
        `SELECT
           COALESCE(AVG((payload->>'amount')::numeric), 0) AS avg_val,
           COUNT(*)::int AS count
         FROM payments
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz ${schoolFilter}`,
        params
      );
      return {
        value: parseFloat(result.rows[0]?.avg_val ?? "0"),
        metadata: { paymentCount: result.rows[0]?.count ?? 0 },
      };
    },
  },
};

export function getSnippet(key: string) {
  return snippetRegistry[key];
}

export function listSnippets() {
  return Object.entries(snippetRegistry).map(([key, { description }]) => ({
    key,
    description,
  }));
}
