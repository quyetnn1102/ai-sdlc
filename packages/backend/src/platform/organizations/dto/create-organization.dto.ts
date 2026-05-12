import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'ACME' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  key: string;

  @ApiPropertyOptional({ example: 'A sample organization' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
