# Dashboard de Performance Comercial

## Overview
Multi-level commercial performance dashboard for a network of six schools. Consolidates CRM, financial, and academic data to present commercial and financial KPIs segmented by seller, school, and network with role-based access control.

## Recent Changes
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
- **users**: id (UUID PK), email, full_name, avatar_url, preferred_language, role, school_id, is_active, created_at, updated_at
- **schools**: id (UUID PK), name, code (unique), timezone, created_at, updated_at
- **user_schools**: id (UUID PK), user_id (FK→users), school_id (FK→schools), role, created_at, updated_at
- **auth_user_sync_logs**: id (UUID PK), user_id (UUID), operation (INSERT/UPDATE/DELETE), payload (text/JSONB), created_at

### Roles
Valid roles: `admin`, `director`, `seller`, `exec`, `finance`, `ops`

### API Endpoints
- `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`
- `GET/POST /api/schools`, `GET/PATCH/DELETE /api/schools/:id`
- `GET /api/user-schools/user/:userId`, `GET /api/user-schools/school/:schoolId`
- `POST /api/user-schools`, `DELETE /api/user-schools/:id`
- `POST /api/auth/sync` — Supabase Auth webhook receiver (service role auth, not session auth)
- `GET /api/auth/sync-logs/:userId` — Admin-only audit trail viewer

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
- `users_school_id_schools_id_fk`: FK users.school_id → schools.id (ON DELETE SET NULL)
- `user_schools_user_id_users_id_fk`: FK user_schools.user_id → users.id (ON DELETE CASCADE)
- `user_schools_school_id_schools_id_fk`: FK user_schools.school_id → schools.id (ON DELETE CASCADE)
- `trg_*_updated_at`: Auto-update triggers on all three tables

## User Preferences
- Language: Portuguese (Brazil)
- Timezone: America/Sao_Paulo
