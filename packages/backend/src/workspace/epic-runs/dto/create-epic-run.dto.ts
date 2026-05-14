import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEpicRunDto {
  @IsString()
  @IsNotEmpty()
  pipelineId: string;

  @IsString()
  @IsNotEmpty()
  workItemId: string;
}
