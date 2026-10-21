import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/decorators.js';

export class CreateRecordDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  notes: string;

  /** Data do atendimento (padrão: agora). Não pode ser futura. */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class CreateAmendmentDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  notes: string;
}
