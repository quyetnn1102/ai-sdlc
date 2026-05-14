import { IsString, IsOptional } from 'class-validator';

export class UpdatePipelineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
