# Dashboard de Performance Comercial

## Overview
This project is a multi-level commercial performance dashboard designed for a network of six schools. Its primary purpose is to consolidate CRM, financial, and academic data into a unified platform. It provides commercial and financial Key Performance Indicators (KPIs) segmented by seller, school, and the entire network, featuring robust role-based access control. The vision is to offer comprehensive insights for better decision-making and operational efficiency across the school network.

## User Preferences
- Language: Portuguese (Brazil)
- Timezone: America/Sao_Paulo

## System Architecture

### Tech Stack
- **Frontend**: React, Vite, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon-backed)
- **ORM**: Drizzle ORM with drizzle-zod
- **Routing**: wouter (frontend), Express (backend)
- **State Management**: TanStack React Query

### Project Structure
The project is structured with `shared` for common schemas and types, `server` for backend logic (DB connection, storage, routes, entry point), `client/src` for the React frontend, and `migrations` for database schema changes.

### Database Schema
The database includes tables for:
-   **Auth & User Management**: `users`, `schools`, `user_schools`, `auth_user_sync_logs`. Users have roles (admin, director, seller, exec, finance, ops) and are linked to schools.
-   **Connector & Sync Management**: `connectors`, `connector_mappings`, `raw_ingest_files`, `sync_runs`. These manage data integration from external sources.
-   **Normalized Data**: `leads`, `payments`, `enrollments`. These tables store processed data from connectors, associated with specific schools.
-   **KPI & Goals**: `kpi_definitions`, `kpi_goals`, `kpi_values`, `kpi_calc_runs`, `calculation_audit`. KPI definitions use a unique `key` (e.g., `new_enrollments`) with calc types (sql, js, materialized). Goals and values are segmented by school (nullable = network-wide). Values use NUMERIC(18,4) for monetary precision. Calc runs track version for reproducibility, with full input/result snapshots in the audit table.

### Data Integration and Sync
A Connector Sync Engine facilitates data ingestion from CRM, financial, and academic systems. It includes:
-   **API Client**: Handles OAuth, token refresh, exponential backoff, and various pagination strategies.
-   **Transform Engine**: Supports 12 transformation operations (e.g., casting, date parsing, regex extraction).
-   **Schema Drift Detection**: Logs unmapped fields during syncs.
-   **Role-Based Access Control (RBAC)**: Implemented at the database level (RLS) and application level, ensuring data visibility is restricted based on user roles and school affiliations.
-   **Connector Management UI**: Provides interfaces for configuring connectors, mapping source fields to target fields, and monitoring sync runs.

### Authentication
Session-based authentication is used, with secure httpOnly cookies. It supports email-only login for development, and integrates with Supabase Auth via a webhook or direct DB trigger for user synchronization. User roles determine access to different parts of the application and data.

### UI/UX
The frontend is built with React, TailwindCSS, and shadcn/ui. It features:
-   A dashboard with KPI cards.
-   Admin pages for user management.
-   Integration pages for managing connectors, mappings, and sync runs.
-   All UI elements are in Portuguese (Brazil) and support dark mode.
-   **Design Tokens**: Primary color is Deep Blue (#1e40af), Accent is Soft Green (#10b981). Typography uses Poppins, Inter, and Courier fonts.

## External Dependencies
-   **PostgreSQL**: Core database, hosted via Neon.
-   **Supabase Auth**: External authentication service for user management.
-   **Vite**: Frontend build tool.
-   **React Query**: Data fetching and state management.
-   **Express.js**: Backend web framework.
-   **Drizzle ORM**: TypeScript ORM for PostgreSQL.
-   **TailwindCSS**: Utility-first CSS framework.
-   **shadcn/ui**: Reusable UI components.