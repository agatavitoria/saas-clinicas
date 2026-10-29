import { applyDecorators } from '@nestjs/common';
import {
  IsBoolean,
  IsDivisibleBy,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OptionalText } from '../../common/validation/decorators.js';

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 480;

/** Termina em Z ou em ±HH:mm: sem fuso, o horário seria ambíguo. */
const EXPLICIT_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

/** Instante com fuso explícito (ex.: 2026-11-02T09:00:00-03:00 ou ...Z). */
export const IsInstant = () =>
  applyDecorators(
    IsISO8601({ strict: true, strictSeparator: true }),
    Matches(EXPLICIT_OFFSET, {
      message: '$property must include a time zone offset',
    }),
  );

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  professionalId: string;

  @IsInstant()
  startsAt: string;

  /** Múltiplo de 5, para caber na grade da agenda. */
  @IsInt()
  @Min(MIN_DURATION_MINUTES)
  @Max(MAX_DURATION_MINUTES)
  @IsDivisibleBy(5)
  durationMinutes: number;

  @IsOptional()
  @OptionalText()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  /** Encaixe: confirma que o horário pode ficar fora do funcionamento. */
  @IsOptional()
  @IsBoolean()
  allowOutsideBusinessHours?: boolean;
}
