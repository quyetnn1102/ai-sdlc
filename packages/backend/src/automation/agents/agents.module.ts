import { Module, forwardRef } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [forwardRef(() => AgentRuntimeModule), AuditModule],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
