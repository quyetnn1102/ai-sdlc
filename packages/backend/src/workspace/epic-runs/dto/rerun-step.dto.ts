import { IsOptional, IsString } from 'class-validator';

export class RerunStepDto {
  @IsString()
  @IsOptional()
  context?: string;
}
