-- Migration: Create Auth Database Schemas
-- Description: Creates public.users, schools, and user_schools tables
--              with indexes, constraints, and role-based access control support
-- Date: 2026-02-10

-- Enable UUID generation
-- gen_random_uuid() is available by default in PostgreSQL 13+

-- 1. Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create users table
-- IMPORTANT: public.users.id MUST mirror auth.users.id when syncing with Supabase Auth.
-- The id column accepts externally-provided UUIDs (from auth.users) and only uses
-- gen_random_uuid() as a fallback for local/seed inserts.
-- When Supabase Auth is connected, insert the auth.users.id explicitly:
--   INSERT INTO public.users (id, email, ...) VALUES (auth_user_id, email, ...);
-- No passwords stored here — Supabase Auth manages credentials.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language VARCHAR(8) DEFAULT 'pt-BR',
  role VARCHAR(20) NOT NULL DEFAULT 'seller'
    CHECK (role IN ('admin', 'director', 'seller', 'exec', 'finance', 'ops')),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create user_schools junction table (many-to-many)
CREATE TABLE IF NOT EXISTS user_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'seller'
    CHECK (role IN ('admin', 'director', 'seller', 'exec', 'finance', 'ops')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes for auth-heavy queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_user_schools_user_id_school_id ON user_schools(user_id, school_id);

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Apply updated_at triggers
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_schools_updated_at
  BEFORE UPDATE ON user_schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Supabase Auth Sync Strategy (stub)
-- When connecting to Supabase Auth, create this trigger on auth.users:
--
-- CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.users (id, email, full_name, avatar_url)
--   VALUES (
--     NEW.id,
--     NEW.email,
--     NEW.raw_user_meta_data->>'full_name',
--     NEW.raw_user_meta_data->>'avatar_url'
--   )
--   ON CONFLICT (id) DO UPDATE SET
--     email = EXCLUDED.email,
--     full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
--     avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
--     updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT OR UPDATE ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Index Strategy Notes:
-- =====================
-- idx_users_email: Supports login/auth lookups (B-tree, unique constraint already creates one)
-- idx_users_role: Supports RBAC role-based filtering and permission checks
-- idx_schools_code: Supports school lookup by code for integrations (unique constraint creates one)
-- idx_user_schools_user_id_school_id: Composite index for junction table lookups
--   - Covers "which schools does user X belong to" queries
--   - Covers "which users belong to school Y" queries (partially, school_id is second)
--   - Consider adding a separate idx on school_id if school->users queries dominate
--
-- Expected Row Growth:
-- ====================
-- users: ~50-200 rows (staff across 6 schools), low growth rate
-- schools: 6 rows initially, very low growth (new campus openings)
-- user_schools: ~100-500 rows (avg 2-3 school assignments per user)
-- All tables are small enough that index maintenance overhead is negligible
