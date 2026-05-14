-- CreateTable
CREATE TABLE "token_usage_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "epic_run_id" TEXT NOT NULL,
    "epic_run_step_id" TEXT NOT NULL,
    "agent_profile_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost" DOUBLE PRECISION NOT NULL,
    "prompt_hash" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_logs_project_id_created_at_idx" ON "token_usage_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "token_usage_logs_epic_run_id_idx" ON "token_usage_logs"("epic_run_id");

-- CreateIndex
CREATE INDEX "token_usage_logs_epic_run_step_id_idx" ON "token_usage_logs"("epic_run_step_id");

-- CreateIndex
CREATE INDEX "token_usage_logs_agent_profile_id_idx" ON "token_usage_logs"("agent_profile_id");

-- CreateIndex
CREATE INDEX "token_usage_logs_prompt_hash_idx" ON "token_usage_logs"("prompt_hash");

-- AddForeignKey
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_epic_run_id_fkey" FOREIGN KEY ("epic_run_id") REFERENCES "epic_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_epic_run_step_id_fkey" FOREIGN KEY ("epic_run_step_id") REFERENCES "epic_run_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_agent_profile_id_fkey" FOREIGN KEY ("agent_profile_id") REFERENCES "agent_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
