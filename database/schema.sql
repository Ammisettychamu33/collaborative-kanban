-- Enums
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Memberships Table
CREATE TABLE IF NOT EXISTS "memberships" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "tenant_id" TEXT REFERENCES "tenants"("id") ON DELETE CASCADE,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_user_org_tenant" UNIQUE ("user_id", "organization_id", "tenant_id")
);

-- 5. Boards Table
CREATE TABLE IF NOT EXISTS "boards" (
    "id" TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Columns Table
CREATE TABLE IF NOT EXISTS "columns" (
    "id" TEXT PRIMARY KEY,
    "board_id" TEXT NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tasks Table
CREATE TABLE IF NOT EXISTS "tasks" (
    "id" TEXT PRIMARY KEY,
    "board_id" TEXT NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
    "column_id" TEXT NOT NULL REFERENCES "columns"("id") ON DELETE CASCADE,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "assigned_to" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "due_date" TIMESTAMPTZ,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Activity Logs Table
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performant tenant-scoped queries & ordering
CREATE INDEX IF NOT EXISTS "idx_tenants_organization_id" ON "tenants"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_memberships_user_id" ON "memberships"("user_id");
CREATE INDEX IF NOT EXISTS "idx_memberships_org_id" ON "memberships"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_memberships_tenant_id" ON "memberships"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_boards_tenant_id" ON "boards"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_boards_org_id" ON "boards"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_columns_board_position" ON "columns"("board_id", "position");
CREATE INDEX IF NOT EXISTS "idx_columns_tenant_id" ON "columns"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_column_position" ON "tasks"("column_id", "position");
CREATE INDEX IF NOT EXISTS "idx_tasks_board_id" ON "tasks"("board_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_tenant_id" ON "tasks"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_tenant_created" ON "activity_logs"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_logs_entity" ON "activity_logs"("entity_type", "entity_id");
