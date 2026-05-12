import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum IntegrationType {
  JIRA = 'JIRA',
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  GITHUB_ACTIONS = 'GITHUB_ACTIONS',
  GITLAB_CI = 'GITLAB_CI',
  JENKINS = 'JENKINS',
  SONARQUBE = 'SONARQUBE',
  SAST = 'SAST',
  PAGERDUTY = 'PAGERDUTY',
}

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationType })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiPropertyOptional({ description: 'Integration settings as key-value map' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, string>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DEGRADED', 'DISCONNECTED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, string>;
}

export class TestConnectionDto {
  @ApiProperty()
  @IsString()
  integrationId: string;
}
