import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/validation/decorators.js';

export class UpdateClinicDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
