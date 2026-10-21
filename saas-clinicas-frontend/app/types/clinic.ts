import type { UserProfile } from './auth'

/** Espelha o CreateClinicDto do backend (POST /platform/clinics). */
export interface CreateClinicPayload {
  clinic: {
    name: string
    email: string
    phone: string
    document?: string
  }
  businessHours: BusinessHour[]
  admin: {
    name: string
    email: string
    temporaryPassword: string
  }
}

export interface BusinessHour {
  /** 0 = domingo ... 6 = sábado */
  weekday: number
  /** HH:mm */
  opensAt: string
  /** HH:mm */
  closesAt: string
}

export type DeletionStatus = 'NONE' | 'REQUESTED' | 'SCHEDULED'

/** Situação do pedido de exclusão (LGPD). */
export interface DeletionInfo {
  status: DeletionStatus
  requestedAt: string | null
  scheduledFor: string | null
  reason: string | null
}

export interface ClinicDetails {
  id: string
  name: string
  email: string
  phone: string
  document: string | null
  active: boolean
  businessHours: BusinessHour[]
  deletion: DeletionInfo
  createdAt: string
}

export interface ClinicSummary {
  id: string
  name: string
  email: string
  phone: string
  active: boolean
  usersCount: number
  /** Só a quantidade: o master não vê dados de pacientes. */
  patientsCount: number
  deletion: DeletionInfo
  createdAt: string
}

export interface ClinicResponse {
  clinic: ClinicDetails
  admin: UserProfile
}

/** Estado do formulário de criação de clínica (antes de virar payload). */
export interface ClinicForm {
  clinic: {
    name: string
    email: string
    phone: string
    document: string
  }
  businessHours: BusinessHourForm[]
  admin: {
    name: string
    email: string
    temporaryPassword: string
  }
}

export interface BusinessHourForm extends BusinessHour {
  open: boolean
}
