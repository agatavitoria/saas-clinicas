import { IsOptional, IsUUID } from 'class-validator';
import { IsInstant } from './create-appointment.dto.js';

/** Agendamentos que se sobrepõem a [from, to); até 31 dias por consulta. */
export class ListAppointmentsDto {
  @IsInstant()
  from: string;

  @IsInstant()
  to: string;

  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;
}
