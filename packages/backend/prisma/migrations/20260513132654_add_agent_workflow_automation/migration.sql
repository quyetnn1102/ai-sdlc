/*
  Warnings:

  - You are about to drop the column `heartbeat_interval_sec` on the `agent_instances` table. All the data in the column will be lost.
  - You are about to drop the column `should_terminate` on the `agent_instances` table. All the data in the column will be lost.
  - The `status` column on the `agent_instances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `config` on the `agent_profiles` table. All the data in the column will be lost.
  - The `status` column on the `workflow_executions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `duration_ms` on the `workflow_tasks` table. All the data in the column will be lost.
  - You are about to drop the column `phase_name` on the `workflow_tasks` table. All the data in the column will be lost.
  - The `status` column on the `workflow_tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updated_at` to the `agent_instances` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `role` on the `agent_profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `description` on table `agent_profiles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `agent_instance_id` on table `artifact_outputs` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `artifact_type` on the `artifact_outputs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `initiated_by` on table `workflow_executions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `config` on table `workflow_executions` required. This step will fail if there are existing NULL values in that column.

*/

-- ============================================================
-- Step 1: Create new enum types
-- ============================================================

CREATE TYPE "AgentRole" AS ENUM ('BA', 'Dev', 'QA', 'DevOps', 'Designer', 'SRE');

CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('pending', 'running', 'paused', 'completed', 'cancelled', 'blocked');

CREATE TYPE "TaskStatus" AS ENUM ('pending', 'assigned', 'running', 'done', 'failed', 'cancelled', 'timed_out');

CREATE TYPE "AgentInstanceStatus" AS ENUM ('pending', 'starting', 'running', 'done', 'failed', 'timed_out');

CREATE TYPE "ArtifactType" AS ENUM ('document', 'code', 'test_plan', 'deployment_script', 'review_report', 'custom');

-- ============================================================
-- Step 2: Drop foreign keys that reference tables being altered
-- ============================================================

ALTER TABLE "agent_profiles" DROP CONSTRAINT IF EXISTS "agent_profiles_project_id_fkey";
ALTER TABLE "artifact_outputs" DROP CONSTRAINT IF EXISTS "artifact_outputs_agent_instance_id_fkey";
ALTER TABLE "phase_agent_mappings" DROP CONSTRAINT IF EXISTS "phase_agent_mappings_agent_profile_id_fkey";
ALTER TABLE "phase_agent_mappings" DROP CONSTRAINT IF EXISTS "phase_agent_mappings_project_id_fkey";
ALTER TABLE "workflow_executions" DROP CONSTRAINT IF EXISTS "workflow_executions_project_id_fkey";

-- ============================================================
-- Step 3: Normalize existing string data to match new enum values
-- ============================================================

-- Normalize agent_profiles.role: old values like BA_AGENT -> BA, DEV_AGENT -> Dev, etc.
UPDATE "agent_profiles" SET "role" = CASE
  WHEN "role" IN ('BA', 'BA_AGENT', 'ba') THEN 'BA'
  WHEN "role" IN ('Dev', 'DEV', 'DEV_AGENT', 'dev') THEN 'Dev'
  WHEN "role" IN ('QA', 'QA_AGENT', 'qa') THEN 'QA'
  WHEN "role" IN ('DevOps', 'DEVOPS', 'DEVOPS_AGENT', 'devops') THEN 'DevOps'
  WHEN "role" IN ('Designer', 'DESIGNER', 'DESIGNER_AGENT', 'designer') THEN 'Designer'
  WHEN "role" IN ('SRE', 'SRE_AGENT', 'sre') THEN 'SRE'
  ELSE 'Dev'
END;

-- Normalize agent_profiles.description: set empty string for NULLs
UPDATE "agent_profiles" SET "description" = '' WHERE "description" IS NULL;

-- Normalize workflow_executions.status: old uppercase -> new lowercase
UPDATE "workflow_executions" SET "status" = CASE
  WHEN UPPER("status") = 'PENDING' THEN 'pending'
  WHEN UPPER("status") = 'RUNNING' THEN 'running'
  WHEN UPPER("status") = 'PAUSED' THEN 'paused'
  WHEN UPPER("status") = 'COMPLETED' THEN 'completed'
  WHEN UPPER("status") = 'CANCELLED' THEN 'cancelled'
  WHEN UPPER("status") = 'BLOCKED' THEN 'blocked'
  ELSE 'pending'
END;

-- Normalize workflow_executions.initiated_by: set a placeholder for NULLs
-- (use the first available user id, or a known system user)
UPDATE "workflow_executions" SET "initiated_by" = (SELECT "id" FROM "users" LIMIT 1)
WHERE "initiated_by" IS NULL;

-- Normalize workflow_executions.config: set empty JSON for NULLs
UPDATE "workflow_executions" SET "config" = '{}' WHERE "config" IS NULL;

-- Normalize workflow_tasks.status: old uppercase -> new lowercase
UPDATE "workflow_tasks" SET "status" = CASE
  WHEN UPPER("status") = 'PENDING' THEN 'pending'
  WHEN UPPER("status") = 'ASSIGNED' THEN 'assigned'
  WHEN UPPER("status") = 'RUNNING' THEN 'running'
  WHEN UPPER("status") = 'DONE' THEN 'done'
  WHEN UPPER("status") = 'FAILED' THEN 'failed'
  WHEN UPPER("status") = 'CANCELLED' THEN 'cancelled'
  WHEN UPPER("status") = 'TIMED_OUT' THEN 'timed_out'
  ELSE 'pending'
END;

-- Normalize agent_instances.status: old uppercase -> new lowercase
UPDATE "agent_instances" SET "status" = CASE
  WHEN UPPER("status") = 'PENDING' THEN 'pending'
  WHEN UPPER("status") = 'STARTING' THEN 'starting'
  WHEN UPPER("status") = 'RUNNING' THEN 'running'
  WHEN UPPER("status") = 'DONE' THEN 'done'
  WHEN UPPER("status") = 'FAILED' THEN 'failed'
  WHEN UPPER("status") = 'TIMED_OUT' THEN 'timed_out'
  ELSE 'pending'
END;

-- Normalize artifact_outputs.artifact_type: old uppercase -> new lowercase
UPDATE "artifact_outputs" SET "artifact_type" = CASE
  WHEN UPPER("artifact_type") = 'DOCUMENT' THEN 'document'
  WHEN UPPER("artifact_type") = 'CODE' THEN 'code'
  WHEN UPPER("artifact_type") = 'TEST_PLAN' THEN 'test_plan'
  WHEN UPPER("artifact_type") = 'DEPLOYMENT_SCRIPT' THEN 'deployment_script'
  WHEN UPPER("artifact_type") = 'REVIEW_REPORT' THEN 'review_report'
  WHEN UPPER("artifact_type") = 'CUSTOM' THEN 'custom'
  ELSE 'custom'
END;

-- ============================================================
-- Step 4: Alter agent_instances — drop old columns, add updated_at
-- ============================================================

ALTER TABLE "agent_instances"
  DROP COLUMN IF EXISTS "heartbeat_interval_sec",
  DROP COLUMN IF EXISTS "should_terminate";

ALTER TABLE "agent_instances"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Convert agent_instances.status TEXT -> AgentInstanceStatus enum
ALTER TABLE "agent_instances" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "agent_instances"
  ALTER COLUMN "status" TYPE "AgentInstanceStatus" USING "status"::"AgentInstanceStatus";
ALTER TABLE "agent_instances" ALTER COLUMN "status" SET DEFAULT 'pending'::"AgentInstanceStatus";

-- ============================================================
-- Step 5: Alter agent_profiles
-- ============================================================

ALTER TABLE "agent_profiles" DROP COLUMN IF EXISTS "config";

-- Convert role TEXT -> AgentRole enum
ALTER TABLE "agent_profiles"
  ALTER COLUMN "role" TYPE "AgentRole" USING "role"::"AgentRole";

ALTER TABLE "agent_profiles"
  ALTER COLUMN "description" SET NOT NULL,
  ALTER COLUMN "skill_set" DROP DEFAULT,
  ALTER COLUMN "supported_phases" DROP DEFAULT;

-- ============================================================
-- Step 6: Alter artifact_outputs
-- ============================================================

ALTER TABLE "artifact_outputs"
  ALTER COLUMN "agent_instance_id" SET NOT NULL;

-- Convert artifact_type TEXT -> ArtifactType enum
ALTER TABLE "artifact_outputs" ALTER COLUMN "artifact_type" DROP DEFAULT;
ALTER TABLE "artifact_outputs"
  ALTER COLUMN "artifact_type" TYPE "ArtifactType" USING "artifact_type"::"ArtifactType";

-- ============================================================
-- Step 7: Alter workflow_executions
-- ============================================================

-- Convert status TEXT -> WorkflowExecutionStatus enum
ALTER TABLE "workflow_executions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workflow_executions"
  ALTER COLUMN "status" TYPE "WorkflowExecutionStatus" USING "status"::"WorkflowExecutionStatus";
ALTER TABLE "workflow_executions" ALTER COLUMN "status" SET DEFAULT 'pending'::"WorkflowExecutionStatus";

ALTER TABLE "workflow_executions"
  ALTER COLUMN "initiated_by" SET NOT NULL,
  ALTER COLUMN "config" SET NOT NULL;

-- ============================================================
-- Step 8: Alter workflow_tasks
-- ============================================================

ALTER TABLE "workflow_tasks"
  DROP COLUMN IF EXISTS "duration_ms",
  DROP COLUMN IF EXISTS "phase_name";

-- Convert status TEXT -> TaskStatus enum
ALTER TABLE "workflow_tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workflow_tasks"
  ALTER COLUMN "status" TYPE "TaskStatus" USING "status"::"TaskStatus";
ALTER TABLE "workflow_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'::"TaskStatus";

-- ============================================================
-- Step 9: Create indexes (IF NOT EXISTS to be idempotent)
-- ============================================================

CREATE INDEX IF NOT EXISTS "agent_instances_status_idx" ON "agent_instances"("status");
CREATE INDEX IF NOT EXISTS "agent_profiles_project_id_idx" ON "agent_profiles"("project_id");
CREATE INDEX IF NOT EXISTS "agent_profiles_role_idx" ON "agent_profiles"("role");
CREATE INDEX IF NOT EXISTS "agent_profiles_is_default_idx" ON "agent_profiles"("is_default");
CREATE INDEX IF NOT EXISTS "artifact_outputs_ai_dlc_artifact_id_idx" ON "artifact_outputs"("ai_dlc_artifact_id");
CREATE INDEX IF NOT EXISTS "task_dependencies_task_id_idx" ON "task_dependencies"("task_id");
CREATE INDEX IF NOT EXISTS "task_dependencies_depends_on_task_id_idx" ON "task_dependencies"("depends_on_task_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_project_id_status_idx" ON "workflow_executions"("project_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_executions_initiated_by_idx" ON "workflow_executions"("initiated_by");
CREATE INDEX IF NOT EXISTS "workflow_tasks_workflow_execution_id_status_idx" ON "workflow_tasks"("workflow_execution_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_tasks_agent_profile_id_idx" ON "workflow_tasks"("agent_profile_id");

-- ============================================================
-- Step 10: Re-add foreign keys
-- ============================================================

ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "phase_agent_mappings" ADD CONSTRAINT "phase_agent_mappings_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "phase_agent_mappings" ADD CONSTRAINT "phase_agent_mappings_agent_profile_id_fkey"
  FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_initiated_by_fkey"
  FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_agent_profile_id_fkey"
  FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "ai_dlc_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifact_outputs" ADD CONSTRAINT "artifact_outputs_agent_instance_id_fkey"
  FOREIGN KEY ("agent_instance_id") REFERENCES "agent_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "artifact_outputs" ADD CONSTRAINT "artifact_outputs_ai_dlc_artifact_id_fkey"
  FOREIGN KEY ("ai_dlc_artifact_id") REFERENCES "ai_dlc_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
