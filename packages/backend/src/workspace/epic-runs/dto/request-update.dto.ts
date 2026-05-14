import { IsOptional, IsString } from 'class-validator';

export class RequestUpdateDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  context?: string;
}
