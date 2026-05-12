import { Module, forwardRef } from '@nestjs/common';
import { AgentExecutorService } from './agent-executor.service';
import { LlmRouterService } from './llm-router.service';
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [forwardRef(() => OrchestrationModule)],
  providers: [AgentExecutorService, LlmRouterService],
  exports: [AgentExecutorService, LlmRouterService],
})
export class AgentRuntimeModule {}
