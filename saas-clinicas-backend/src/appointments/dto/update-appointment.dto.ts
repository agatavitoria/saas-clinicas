import {
  IsBoolean,
  IsDivisibleBy,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OptionalText } from '../../common/validation/decorators.js';
import {
  IsInstant,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from './create-appointment.dto.js';

/** Remarcação e observação; só os campos enviados mudam. */
export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsInstant()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_DURATION_MINUTES)
  @Max(MAX_DURATION_MINUTES)
  @IsDivisibleBy(5)
  durationMinutes?: number;

  /** null ou vazio limpa a observação. */
  @IsOptional()
  @OptionalText()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  allowOutsideBusinessHours?: boolean;
}
