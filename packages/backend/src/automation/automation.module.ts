import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { AgentRuntimeModule } from './agent-runtime/agent-runtime.module';

@Module({
  imports: [AgentsModule, OrchestrationModule, AgentRuntimeModule],
  exports: [AgentsModule, OrchestrationModule, AgentRuntimeModule],
})
export class AutomationModule {}
