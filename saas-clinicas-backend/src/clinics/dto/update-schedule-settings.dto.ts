import { IsDivisibleBy, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIanaTimeZone } from '../../common/validation/decorators.js';

export const MIN_APPOINTMENT_MINUTES = 5;
export const MAX_APPOINTMENT_MINUTES = 240;

/** Configurações da agenda; só os campos enviados mudam. */
export class UpdateScheduleSettingsDto {
  /** Ex.: America/Sao_Paulo */
  @IsOptional()
  @IsIanaTimeZone()
  timeZone?: string;

  /** Múltiplo de 5, para caber na grade da agenda. */
  @IsOptional()
  @IsInt()
  @Min(MIN_APPOINTMENT_MINUTES)
  @Max(MAX_APPOINTMENT_MINUTES)
  @IsDivisibleBy(5)
  defaultAppointmentMinutes?: number;
}
