-- ============================================================================
-- Migration 038: System Connector Seed
-- Creates a virtual "system" connector used as source_connector_id when a
-- lead is promoted to an enrollment via the POST /api/leads/:id/promote
-- endpoint (i.e., not sourced from a real external connector).
-- ============================================================================

-- Insert a system connector owned by the first admin user, if it does not
-- already exist.  Uses ON CONFLICT DO NOTHING to make this idempotent.
INSERT INTO public.connectors (
  id,
  name,
  type,
  config,
  owner_id,
  is_active
)
SELECT
  gen_random_uuid(),
  'Sistema',
  'manual_input',
  '{}',
  u.id,
  true
FROM public.users u
WHERE u.role = 'admin'
ORDER BY u.created_at
LIMIT 1
ON CONFLICT DO NOTHING;

-- Add a unique, queryable code column if not already present, then set it.
-- We use a comment column alternative: store the identifier in the name field
-- with a recognisable sentinel.  More robustly, we index by name.

-- Index for fast lookup by connector name
CREATE INDEX IF NOT EXISTS idx_connectors_name
  ON public.connectors (name)
  WHERE name IS NOT NULL;
