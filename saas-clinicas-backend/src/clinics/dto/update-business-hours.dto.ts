import { BusinessHourDto, IsBusinessHours } from './create-clinic.dto.js';

/** Substitui a semana inteira: os dias ausentes ficam fechados. */
export class UpdateBusinessHoursDto {
  @IsBusinessHours()
  businessHours: BusinessHourDto[];
}
