import { Module, forwardRef } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import {
  OrchestrationController,
  AgentCallbackController,
  OrchestrationAdminController,
} from './orchestration.controller';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  // Use forwardRef to break the circular dependency:
  // OrchestrationModule ← AgentRuntimeModule imports OrchestrationModule
  imports: [forwardRef(() => AgentRuntimeModule)],
  providers: [OrchestrationService],
  controllers: [
    OrchestrationController,
    AgentCallbackController,
    OrchestrationAdminController,
  ],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
