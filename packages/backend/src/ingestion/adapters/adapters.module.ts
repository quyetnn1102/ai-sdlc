import { Module } from '@nestjs/common';
import { JiraAdapter } from './jira.adapter';
import { GitHubAdapter } from './github.adapter';
import { SonarQubeAdapter } from './sonarqube.adapter';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [JiraAdapter, GitHubAdapter, SonarQubeAdapter],
  exports: [JiraAdapter, GitHubAdapter, SonarQubeAdapter],
})
export class AdaptersModule {}
