import { Module, forwardRef } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { SchedulerService } from './scheduler.service';
import { MonitoringService } from './monitoring.service';
import {
  OrchestrationController,
  AgentCallbackController,
  OrchestrationAdminController,
} from './orchestration.controller';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { NotificationService } from './notification.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [forwardRef(() => AgentRuntimeModule), AuditModule],
  providers: [OrchestrationService, SchedulerService, MonitoringService, NotificationService],
  controllers: [
    OrchestrationController,
    AgentCallbackController,
    OrchestrationAdminController,
  ],
  exports: [OrchestrationService, SchedulerService, MonitoringService, NotificationService],
})
export class OrchestrationModule {}
