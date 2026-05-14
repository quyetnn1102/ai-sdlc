-- CreateEnum
CREATE TYPE "EpicRunStatus" AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EpicRunStepStatus" AS ENUM ('pending', 'running', 'completed', 'approved', 'rejected', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "inputs" JSONB,
    "outputs" JSONB,
    "metadata" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "agent_profile_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_steps" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "agent_profile_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "on_failure" TEXT NOT NULL DEFAULT 'stop',

    CONSTRAINT "pipeline_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epic_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "work_item_id" TEXT NOT NULL,
    "status" "EpicRunStatus" NOT NULL DEFAULT 'pending',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "initiated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epic_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epic_run_steps" (
    "id" TEXT NOT NULL,
    "epic_run_id" TEXT NOT NULL,
    "pipeline_step_id" TEXT NOT NULL,
    "agent_profile_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "status" "EpicRunStepStatus" NOT NULL DEFAULT 'pending',
    "output" TEXT,
    "feedback" TEXT,
    "context" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epic_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epic_run_history" (
    "id" TEXT NOT NULL,
    "epic_run_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epic_run_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_configs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "slash_commands" JSONB,
    "metadata" JSONB,
    "yaml_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "walkthrough_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "walkthrough_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_project_id_name_key" ON "skills"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_agent_profile_id_skill_id_key" ON "agent_skills"("agent_profile_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_project_id_name_key" ON "pipelines"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_steps_pipeline_id_step_order_key" ON "pipeline_steps"("pipeline_id", "step_order");

-- CreateIndex
CREATE INDEX "epic_runs_project_id_status_idx" ON "epic_runs"("project_id", "status");

-- CreateIndex
CREATE INDEX "epic_run_steps_epic_run_id_status_idx" ON "epic_run_steps"("epic_run_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "epic_run_steps_epic_run_id_step_order_key" ON "epic_run_steps"("epic_run_id", "step_order");

-- CreateIndex
CREATE INDEX "epic_run_history_epic_run_id_idx" ON "epic_run_history"("epic_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_configs_project_id_key" ON "workspace_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_templates_organization_id_name_key" ON "workspace_templates"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "walkthrough_states_user_id_project_id_key" ON "walkthrough_states"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_profile_id_fkey" FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_agent_profile_id_fkey" FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epic_runs" ADD CONSTRAINT "epic_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epic_runs" ADD CONSTRAINT "epic_runs_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epic_runs" ADD CONSTRAINT "epic_runs_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epic_run_steps" ADD CONSTRAINT "epic_run_steps_epic_run_id_fkey" FOREIGN KEY ("epic_run_id") REFERENCES "epic_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epic_run_steps" ADD CONSTRAINT "epic_run_steps_agent_profile_id_fkey" FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_configs" ADD CONSTRAINT "workspace_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_templates" ADD CONSTRAINT "workspace_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
