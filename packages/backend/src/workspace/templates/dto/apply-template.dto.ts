import { IsString, IsIn } from 'class-validator';

export class ApplyTemplateDto {
  @IsString()
  @IsIn(['skip', 'rename', 'overwrite'])
  conflictResolution: 'skip' | 'rename' | 'overwrite';
}
