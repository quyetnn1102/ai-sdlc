import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  inputs?: Record<string, unknown>[];

  @IsOptional()
  outputs?: Record<string, unknown>[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
