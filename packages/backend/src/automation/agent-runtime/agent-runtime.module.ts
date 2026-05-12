import { Module, forwardRef } from '@nestjs/common';
import { AgentExecutorService } from './agent-executor.service';
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [forwardRef(() => OrchestrationModule)],
  providers: [AgentExecutorService],
  exports: [AgentExecutorService],
})
export class AgentRuntimeModule {}
