import type { Gender, UserRole } from '../generated/prisma/enums.js';

export const PATIENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  socialName: true,
  cpf: true,
  birthDate: true,
  phone: true,
  active: true,
} as const;

export const PATIENT_DETAILS_SELECT = {
  ...PATIENT_SUMMARY_SELECT,
  gender: true,
  email: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface PatientSummary {
  id: string;
  name: string;
  socialName: string | null;
  cpf: string;
  birthDate: Date;
  phone: string | null;
  active: boolean;
}

export interface PatientDetails extends PatientSummary {
  gender: Gender | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientPage {
  items: PatientSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecordAuthor {
  id: string;
  name: string;
  roles: UserRole[];
}

export interface PatientRecordEntry {
  id: string;
  occurredAt: Date;
  notes: string;
  createdAt: Date;
  professional: RecordAuthor;
}

/** Registro original com seus adendos (em ordem cronológica). */
export interface PatientRecordWithAmendments extends PatientRecordEntry {
  amendments: PatientRecordEntry[];
}

export const RECORD_SELECT = {
  id: true,
  occurredAt: true,
  notes: true,
  createdAt: true,
  professional: { select: { id: true, name: true, roles: true } },
} as const;
