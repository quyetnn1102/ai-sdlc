import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class ReorderStepsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'stepIds must contain at least one step ID' })
  stepIds: string[];
}
