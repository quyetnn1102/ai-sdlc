import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { OrchestrationModule } from './orchestration/orchestration.module';

@Module({
  imports: [AgentsModule, OrchestrationModule],
  exports: [AgentsModule, OrchestrationModule],
})
export class AutomationModule {}
