import { AppointmentStatus } from '../generated/prisma/enums.js';

/** Agendamentos em aberto: ainda podem ser confirmados, remarcados ou cancelados. */
export const OPEN_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

/** Cancelado, realizado e falta são finais. */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  CONFIRMED: [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

export const canTransition = (
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean => TRANSITIONS[from].includes(to);

/** Só agendamentos ainda em aberto podem ser remarcados. */
export const isEditable = (status: AppointmentStatus): boolean =>
  OPEN_STATUSES.includes(status);

/** Realizado e falta só fazem sentido depois do horário marcado. */
export const requiresStarted = (status: AppointmentStatus): boolean =>
  status === AppointmentStatus.COMPLETED ||
  status === AppointmentStatus.NO_SHOW;
