export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

export interface Appointment {
  id: string
  /** ISO (UTC) */
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  /** Encaixe fora do horário de funcionamento */
  outsideBusinessHours: boolean
  notes: string | null
  cancelReason: string | null
  createdAt: string
  patient: { id: string, name: string, socialName: string | null }
  professional: { id: string, name: string }
}

export interface Professional {
  id: string
  name: string
}

/** Corpo de POST /appointments (PATCH aceita os mesmos campos, opcionais). */
export interface AppointmentPayload {
  patientId: string
  professionalId: string
  /** Instante com fuso (ISO) */
  startsAt: string
  durationMinutes: number
  notes: string | null
  allowOutsideBusinessHours?: boolean
}
