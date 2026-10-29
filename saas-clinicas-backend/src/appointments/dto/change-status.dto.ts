import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalText } from '../../common/validation/decorators.js';
import { AppointmentStatus } from '../../generated/prisma/enums.js';

/** Todo agendamento nasce SCHEDULED; daqui só se avança. */
const TARGET_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
] as const;

export class ChangeStatusDto {
  @IsIn(TARGET_STATUSES)
  status: (typeof TARGET_STATUSES)[number];

  /** Só no cancelamento (o service recusa nos outros status). */
  @IsOptional()
  @OptionalText()
  @IsString()
  @MaxLength(500)
  cancelReason?: string | null;
}
