-- Rollback: Remove Auth Database Schemas
-- Description: Drops user_schools, users, and schools tables and related objects
-- Date: 2026-02-10
-- WARNING: This will permanently delete all data in these tables

-- 1. Drop triggers
DROP TRIGGER IF EXISTS trg_user_schools_updated_at ON user_schools;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;

-- 2. Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS user_schools CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- 3. Drop trigger function (only if no other tables use it)
DROP FUNCTION IF EXISTS update_updated_at_column();
