import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/validation/decorators.js';

export class RequestDeletionDto {
  /** Nome da clínica digitado pelo admin, para confirmar a intenção. */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  confirmationName: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
