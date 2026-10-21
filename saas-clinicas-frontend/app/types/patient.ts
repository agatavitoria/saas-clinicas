import type { UserRole } from './auth'

export type Gender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER' | 'UNDISCLOSED'

export interface PatientSummary {
  id: string
  name: string
  socialName: string | null
  cpf: string
  /** ISO, meia-noite UTC (só a data importa) */
  birthDate: string
  phone: string | null
  active: boolean
}

export interface PatientDetails extends PatientSummary {
  gender: Gender | null
  email: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientPage {
  items: PatientSummary[]
  total: number
  page: number
  pageSize: number
}

/** Corpo de POST/PATCH /patients (datas em YYYY-MM-DD). */
export interface PatientPayload {
  name: string
  cpf: string
  birthDate: string
  socialName: string | null
  gender: Gender | null
  phone: string | null
  email: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

export interface PatientRecordEntry {
  id: string
  occurredAt: string
  notes: string
  createdAt: string
  professional: { id: string, name: string, roles: UserRole[] }
}

export interface PatientRecord extends PatientRecordEntry {
  amendments: PatientRecordEntry[]
}
