# Dashboard de Performance Comercial

## Overview
Multi-level commercial performance dashboard for a network of six schools. Consolidates CRM, financial, and academic data to present commercial and financial KPIs segmented by seller, school, and network with role-based access control.

## Recent Changes
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

### Roles
Valid roles: `admin`, `director`, `seller`, `exec`, `finance`, `ops`

### API Endpoints
- `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`
- `GET/POST /api/schools`, `GET/PATCH/DELETE /api/schools/:id`
- `GET /api/user-schools/user/:userId`, `GET /api/user-schools/school/:schoolId`
- `POST /api/user-schools`, `DELETE /api/user-schools/:id`

### Design Tokens
- Primary: Deep Blue (#1e40af / HSL 217 91% 40%)
- Accent: Soft Green (#10b981)
- Typography: Poppins (headings), Inter (body), Courier (mono/data)

### Supabase Auth Sync Strategy
- `public.users.id` accepts externally-provided UUIDs from `auth.users`
- The `insertUserSchema` allows passing an explicit `id` field for sync
- A trigger stub for `auth.users` → `public.users` sync is documented in `migrations/001_auth_tables.sql`
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
