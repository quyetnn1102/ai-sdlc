import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePipelineStepDto {
  @IsString()
  @IsNotEmpty()
  agentProfileId: string;

  @IsString()
  @IsOptional()
  @IsIn(['stop', 'continue'])
  onFailure?: string;
}

export class CreatePipelineDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Pipeline must have at least 2 steps' })
  @ValidateNested({ each: true })
  @Type(() => CreatePipelineStepDto)
  steps: CreatePipelineStepDto[];
}
