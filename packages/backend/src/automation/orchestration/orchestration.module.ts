import { Module } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { OrchestrationController, AgentCallbackController } from './orchestration.controller';

@Module({
  providers: [OrchestrationService],
  controllers: [OrchestrationController, AgentCallbackController],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
