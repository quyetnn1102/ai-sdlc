import { IsNotEmpty, IsString } from 'class-validator';

export class RejectStepDto {
  @IsString()
  @IsNotEmpty()
  feedback: string;
}
