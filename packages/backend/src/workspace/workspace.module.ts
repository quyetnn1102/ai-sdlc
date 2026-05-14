import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditModule } from '../common/audit/audit.module';
import { SkillsService } from './skills/skills.service';
import { SkillsController } from './skills/skills.controller';
import { PipelinesService } from './pipelines/pipelines.service';
import { PipelinesController } from './pipelines/pipelines.controller';
import { EpicRunsService } from './epic-runs/epic-runs.service';
import { EpicRunsController } from './epic-runs/epic-runs.controller';
import { WorkspaceConfigService } from './config/workspace-config.service';
import { WorkspaceConfigController } from './config/workspace-config.controller';
import { InspectorService } from './inspector/inspector.service';
import { TemplatesService } from './templates/templates.service';
import { TemplatesController } from './templates/templates.controller';
import { DemoService } from './demo/demo.service';
import { DemoController } from './demo/demo.controller';
import { TokenUsageModule } from './token-usage/token-usage.module';

@Module({
  imports: [PrismaModule, AuditModule, TokenUsageModule],
  controllers: [
    SkillsController,
    PipelinesController,
    EpicRunsController,
    WorkspaceConfigController,
    TemplatesController,
    DemoController,
  ],
  providers: [
    SkillsService,
    PipelinesService,
    EpicRunsService,
    WorkspaceConfigService,
    InspectorService,
    TemplatesService,
    DemoService,
  ],
  exports: [
    SkillsService,
    PipelinesService,
    EpicRunsService,
    WorkspaceConfigService,
    InspectorService,
    TemplatesService,
    DemoService,
  ],
})
export class WorkspaceModule {}
