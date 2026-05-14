import { IsString, IsOptional } from 'class-validator';

export class UpdateSkillDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  inputs?: Record<string, unknown>[];

  @IsOptional()
  outputs?: Record<string, unknown>[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
