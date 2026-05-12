import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum GateRuleType {
  MIN_COVERAGE = 'MIN_COVERAGE',
  MAX_CRITICAL_ISSUES = 'MAX_CRITICAL_ISSUES',
  CI_CHECK_PASS = 'CI_CHECK_PASS',
}

export enum GateEnforcement {
  ADVISORY = 'ADVISORY',
  BLOCKING = 'BLOCKING',
}

export class CreateGateDto {
  @ApiProperty({ example: 'Coverage check' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Workflow phase UUID' })
  @IsString()
  workflowPhaseId: string;

  @ApiProperty({ enum: GateRuleType })
  @IsEnum(GateRuleType)
  ruleType: GateRuleType;

  @ApiProperty({ example: { threshold: 80 } })
  @IsObject()
  ruleConfig: Record<string, unknown>;

  @ApiPropertyOptional({ enum: GateEnforcement })
  @IsOptional()
  @IsEnum(GateEnforcement)
  enforcement?: GateEnforcement;
}
