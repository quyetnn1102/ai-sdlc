import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './platform/auth/auth.module';
import { UsersModule } from './platform/users/users.module';
import { OrganizationsModule } from './platform/organizations/organizations.module';
import { ProjectsModule } from './platform/projects/projects.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    // Platform Service
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
  ],
})
export class AppModule {}
