# Dashboard de Performance Comercial

## Overview
Multi-level commercial performance dashboard for a network of six schools. Consolidates CRM, financial, and academic data to present commercial and financial KPIs segmented by seller, school, and network with role-based access control.

## Recent Changes
- **2026-02-10**: Connectors RLS Policies & RBAC Routes
  - RLS enabled on connectors, connector_mappings, sync_runs, raw_ingest_files, leads, payments, enrollments
  - Helper functions: is_connector_owner, is_ops, is_exec, get_user_school_ids, is_user_in_school
  - Connectors: owner/admin SELECT, admin INSERT/UPDATE/DELETE, ops SELECT, owner UPDATE
  - Connector_mappings: owner or admin for all CRUD operations
  - Sync_runs & raw_ingest_files: append-only (DELETE denied), admin/ops INSERT/UPDATE
  - Normalized data: admin/exec/ops see all; director/finance/seller see school-scoped via user_schools join
  - Application-level RBAC: isOps, isExec, isConnectorOwner, getUserSchoolIds, canViewNormalizedData helpers
  - Full API routes for connectors, mappings, sync-runs, files, leads, payments, enrollments
  - SQL migration 005 with rollback
- **2026-02-10**: Connectors & Sync Schemas
  - Created `connectors` table: name, type (crm/finance/academic), config (JSONB), schedule_cron, owner_id FK→users
  - Created `connector_mappings` table: connector_id FK, source_path, target_field, transform (JSONB)
  - Created `raw_ingest_files` table: connector_id FK, bucket_path, file_name, file_size, processed
  - Created `sync_runs` table: connector_id FK, started_at, finished_at, status, records_in/out, error (JSONB)
  - Normalized data tables: `leads`, `payments`, `enrollments` with source_connector_id, source_id, payload (JSONB), school_id
  - Unique composite indexes on (source_connector_id, source_id) for upsert support
  - CHECK constraints: connectors.type, sync_runs.status
  - Auto-updated_at triggers on connectors, connector_mappings, leads, payments, enrollments
  - IStorage interface + DatabaseStorage CRUD methods for all new tables (with upsert for normalized tables)
  - SQL migration 004 with rollback
- **2026-02-10**: Auth Frontend Pages & Session Auth
  - Session-based auth with express-session (httpOnly cookies, secure in production)
  - Auth endpoints: POST /api/auth/login (email-only dev mode), POST /api/auth/logout, GET /api/auth/me, GET /api/auth/dev-users
  - Login page with 3 tabs: E-mail (email-only, password deferred to Supabase), Magic Link (placeholder), Dev picker
  - Signup page (/signup) and Reset Password page (/reset-password) — UI-only placeholders
  - Dashboard page (/) with KPI cards (Matrículas, Receita, Escolas, Conversão)
  - Admin Users page (/admin/users) with user table, role/school assignment, add user dialog, optimistic updates
  - useAuth hook (signIn/signOut) and ProtectedRoute component with role-based guards
  - AppLayout with collapsible shadcn Sidebar, dark mode toggle (localStorage + .dark class), user profile in footer
  - All UI in Portuguese (Brazil); data-testid attributes on all interactive/display elements
  - loadCurrentUser reads session first, falls back to x-user-id header for RBAC middleware compatibility
- **2026-02-10**: Created Auth Sync Trigger and Webhook
  - Created `auth_user_sync_logs` audit trail table (Drizzle schema + SQL migration 003)
  - Implemented `sync_auth_user()` PostgreSQL trigger function for direct DB trigger on auth.users
  - Created Express webhook endpoint `POST /api/auth/sync` for Supabase Auth webhook/edge function approach
  - INSERT: creates public.users with id=auth.users.id, email, metadata (full_name, avatar_url)
  - UPDATE: upserts mutable fields (email, full_name, avatar_url) with ON CONFLICT handling
  - DELETE: soft-deletes user (is_active=false) instead of hard delete
  - Webhook auth: validates via SUPABASE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY
  - Admin-only endpoint `GET /api/auth/sync-logs/:userId` for viewing sync audit trail
  - Added `upsertUserFromAuth()` and `softDeleteUser()` storage methods
  - Migration rollback provided (003_auth_sync_trigger_rollback.sql)
- **2026-02-10**: Set Auth RLS Policies and application-level RBAC
  - Created RLS policy SQL migration (002_rls_policies.sql) for Supabase deployment
  - Implemented Express RBAC middleware (server/rbac.ts) enforcing equivalent access rules
  - All API routes now require authentication via x-user-id header
  - Role-based access: admin sees all, seller sees only own data, directors see school scope
  - Users can only update own mutable fields (full_name, avatar_url, preferred_language)
  - Schools: all authenticated users see minimal info; elevated roles see full records
  - User-schools: user sees own, admin sees all, director sees their school's mappings
- **2026-02-10**: Created auth database schemas (users, schools, user_schools) with PostgreSQL
  - Added CHECK constraints for role validation (admin, director, seller, exec, finance, ops)
  - Added updated_at triggers for automatic timestamp management
  - Seeded 6 schools, 5 users, and 12 user-school mappings
  - Created migration SQL files with rollback support

## Project Architecture

### Tech Stack
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon-backed via Replit)
- **ORM**: Drizzle ORM with drizzle-zod for validation
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack React Query

### Project Structure
```
shared/schema.ts       - Drizzle schemas, Zod validation, TypeScript types
server/db.ts           - Database connection (pg Pool + Drizzle)
server/storage.ts      - DatabaseStorage class implementing IStorage interface
server/routes.ts       - Express API routes (all prefixed with /api)
server/seed.ts         - Database seeding (runs once on startup)
server/index.ts        - Express app entry point
client/src/            - React frontend
migrations/            - SQL migration and rollback files
```

### Database Schema

#### Auth & User Tables
- **users**: id (UUID PK), email, full_name, avatar_url, preferred_language, role, school_id, is_active, created_at, updated_at
- **schools**: id (UUID PK), name, code (unique), timezone, created_at, updated_at
- **user_schools**: id (UUID PK), user_id (FK→users), school_id (FK→schools), role, created_at, updated_at
- **auth_user_sync_logs**: id (UUID PK), user_id (UUID), operation (INSERT/UPDATE/DELETE), payload (text/JSONB), created_at

#### Connector & Sync Tables
- **connectors**: id (UUID PK), name, type (crm|finance|academic), config (JSONB), schedule_cron, owner_id (FK→users), is_active, created_at, updated_at
- **connector_mappings**: id (UUID PK), connector_id (FK→connectors), source_path, target_field, transform (JSONB), created_at, updated_at
- **raw_ingest_files**: id (UUID PK), connector_id (FK→connectors), bucket_path, file_name, file_size (bigint), processed, created_at
- **sync_runs**: id (UUID PK), connector_id (FK→connectors), started_at, finished_at, status (pending|running|success|failed), records_in, records_out, error (JSONB), created_at

#### Normalized Data Tables
- **leads**: id (UUID PK), source_connector_id (FK→connectors), source_id (unique with connector), payload (JSONB), school_id (FK→schools), created_at, updated_at
- **payments**: id (UUID PK), source_connector_id (FK→connectors), source_id (unique with connector), payload (JSONB), school_id (FK→schools), created_at, updated_at
- **enrollments**: id (UUID PK), source_connector_id (FK→connectors), source_id (unique with connector), payload (JSONB), school_id (FK→schools), created_at, updated_at

### Roles
Valid roles: `admin`, `director`, `seller`, `exec`, `finance`, `ops`

### API Endpoints
- `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`
- `GET/POST /api/schools`, `GET/PATCH/DELETE /api/schools/:id`
- `GET /api/user-schools/user/:userId`, `GET /api/user-schools/school/:schoolId`
- `POST /api/user-schools`, `DELETE /api/user-schools/:id`
- `POST /api/auth/login` — Session login (email-only in dev mode)
- `POST /api/auth/logout` — Session logout
- `GET /api/auth/me` — Current session user
- `GET /api/auth/dev-users` — Dev-mode user list (id, email, fullName, role)
- `POST /api/auth/sync` — Supabase Auth webhook receiver (service role auth, not session auth)
- `GET /api/auth/sync-logs/:userId` — Admin-only audit trail viewer
- `GET/POST /api/connectors`, `GET/PATCH/DELETE /api/connectors/:id` — Admin creates; owner/admin/ops can read
- `GET/POST /api/connectors/:connectorId/mappings` — Owner or admin only
- `PATCH/DELETE /api/connector-mappings/:id` — Owner or admin only
- `GET/POST /api/connectors/:connectorId/sync-runs` — Owner/admin/ops can read; admin/ops can create
- `PATCH /api/sync-runs/:id` — Admin/ops only (update status)
- `GET/POST /api/connectors/:connectorId/files` — Owner/admin/ops can read; admin/ops can create
- `GET /api/leads` — School-scoped: seller/director/finance see their schools; admin/exec/ops see all
- `GET /api/payments` — School-scoped: same as leads
- `GET /api/enrollments` — School-scoped: same as leads

### Frontend Pages
- `/login` — Login (3 tabs: E-mail, Link mágico, Dev picker)
- `/signup` — Signup (placeholder, UI-only)
- `/reset-password` — Reset password (placeholder, UI-only)
- `/` — Dashboard with KPI cards (protected, all authenticated roles)
- `/admin/users` — Admin user management (protected, admin-only)

### Design Tokens
- Primary: Deep Blue (#1e40af / HSL 217 91% 40%)
- Accent: Soft Green (#10b981)
- Typography: Poppins (headings), Inter (body), Courier (mono/data)

### Supabase Auth Sync Strategy
- `public.users.id` accepts externally-provided UUIDs from `auth.users`
- The `insertUserSchema` allows passing an explicit `id` field for sync
- **Two sync approaches** (choose based on Supabase access level):
  - **Direct DB trigger**: `sync_auth_user()` function + trigger on auth.users (migration 003)
  - **Webhook/Edge Function**: `POST /api/auth/sync` endpoint receives Supabase Auth events
- Webhook auth: `SUPABASE_WEBHOOK_SECRET` header or `SUPABASE_SERVICE_ROLE_KEY` bearer token
- INSERT → upsert into public.users; UPDATE → upsert mutable fields; DELETE → soft-delete (is_active=false)
- All sync operations logged to `auth_user_sync_logs` for audit trail
- Role values use CHECK constraints (not Postgres ENUM) for easier extensibility
- No passwords stored in public.users — Supabase Auth manages credentials

### Constraints
- `chk_users_role`: CHECK constraint on users.role
- `chk_user_schools_role`: CHECK constraint on user_schools.role
- `chk_connectors_type`: CHECK constraint on connectors.type (crm, finance, academic)
- `chk_sync_runs_status`: CHECK constraint on sync_runs.status (pending, running, success, failed)
- `uq_leads_source`: UNIQUE(source_connector_id, source_id) for upsert
- `uq_payments_source`: UNIQUE(source_connector_id, source_id) for upsert
- `uq_enrollments_source`: UNIQUE(source_connector_id, source_id) for upsert
- `users_school_id_schools_id_fk`: FK users.school_id → schools.id (ON DELETE SET NULL)
- `user_schools_*_fk`: FK CASCADE to users and schools
- `connectors_owner_id_fk`: FK connectors.owner_id → users.id (ON DELETE CASCADE)
- `connector_mappings_connector_id_fk`: FK → connectors (ON DELETE CASCADE)
- `raw_ingest_files_connector_id_fk`: FK → connectors (ON DELETE CASCADE)
- `sync_runs_connector_id_fk`: FK → connectors (ON DELETE CASCADE)
- `leads/payments/enrollments_source_connector_id_fk`: FK → connectors (ON DELETE CASCADE)
- `leads/payments/enrollments_school_id_fk`: FK → schools (ON DELETE SET NULL)
- `trg_*_updated_at`: Auto-update triggers on all tables with updated_at column

## User Preferences
- Language: Portuguese (Brazil)
- Timezone: America/Sao_Paulo
