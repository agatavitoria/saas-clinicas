import type { AppointmentStatus } from '../generated/prisma/enums.js';

export const APPOINTMENT_SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  outsideBusinessHours: true,
  notes: true,
  cancelReason: true,
  createdAt: true,
  patient: { select: { id: true, name: true, socialName: true } },
  professional: { select: { id: true, name: true } },
} as const;

export interface AppointmentView {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  /** Encaixe fora do horário de funcionamento. */
  outsideBusinessHours: boolean;
  notes: string | null;
  cancelReason: string | null;
  createdAt: Date;
  patient: { id: string; name: string; socialName: string | null };
  professional: { id: string; name: string };
}

/** Profissional disponível para agendamento. */
export interface ProfessionalOption {
  id: string;
  name: string;
}
