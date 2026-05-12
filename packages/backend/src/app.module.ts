import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Common
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';
import { AuditModule } from './common/audit/audit.module';

// ── Platform Service ───────────────────────────────────────────────────
import { AuthModule } from './platform/auth/auth.module';
import { UsersModule } from './platform/users/users.module';
import { OrganizationsModule } from './platform/organizations/organizations.module';
import { ProjectsModule } from './platform/projects/projects.module';

// ── Ingestion Service ──────────────────────────────────────────────────
import { IntegrationsModule } from './ingestion/integrations/integrations.module';
import { AdaptersModule } from './ingestion/adapters/adapters.module';
import { WebhooksModule } from './ingestion/webhooks/webhooks.module';
import { WorkItemsModule } from './ingestion/work-items/work-items.module';
import { SchedulerModule } from './ingestion/scheduler/scheduler.module';

// ── Analytics Service ──────────────────────────────────────────────────
import { WorkflowModule } from './analytics/workflow/workflow.module';
import { MetricsModule } from './analytics/metrics/metrics.module';
import { GatesModule } from './analytics/gates/gates.module';

// ── Knowledge Service ──────────────────────────────────────────────────
import { TraceabilityModule } from './knowledge/traceability/traceability.module';
import { RetrospectivesModule } from './knowledge/retrospectives/retrospectives.module';
import { TestManagementModule } from './knowledge/test-management/test-management.module';
import { IncidentsModule } from './knowledge/incidents/incidents.module';
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    // Config (global — available everywhere)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting — 100 requests per 60 seconds per IP globally
    // Individual endpoints can override with @Throttle() decorator
    ThrottlerModule.forRoot([{
      ttl: 60000,  // 60 seconds
      limit: 100,
    }]),

    // Database (global — PrismaService injectable everywhere)
    PrismaModule,

    // Infrastructure
    HealthModule,
    AuditModule,

    // ── Platform ──
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,

    // ── Ingestion ──
    IntegrationsModule,
    AdaptersModule,
    WebhooksModule,
    WorkItemsModule,
    SchedulerModule,

    // ── Analytics ──
    WorkflowModule,
    MetricsModule,
    GatesModule,

    // ── Knowledge ──
    TraceabilityModule,
    RetrospectivesModule,
    TestManagementModule,
    IncidentsModule,

    // ── Automation (v4) ──
    AutomationModule,
  ],
  providers: [
    // Apply rate limiting globally — individual endpoints can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
