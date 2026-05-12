import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Mobile App' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'MOB' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  key: string;

  @ApiPropertyOptional({ example: 'Main mobile application project' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Asia/Tokyo' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
