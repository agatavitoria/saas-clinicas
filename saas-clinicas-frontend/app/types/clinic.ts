/** Espelha o CreateClinicDto do backend (POST /clinics). */
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
    password: string
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

export interface ClinicResponse {
  clinic: {
    id: string
    name: string
    email: string
    phone: string
    document: string | null
    businessHours: BusinessHour[]
    createdAt: string
  }
  admin: {
    id: string
    tenantId: string
    name: string
    email: string
    role: 'ADMIN' | 'PROFESSIONAL' | 'RECEPTION'
  }
}

/** Estado do formulário de cadastro (antes de virar payload). */
export interface ClinicSignupForm {
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
    password: string
    passwordConfirmation: string
  }
}

export interface BusinessHourForm extends BusinessHour {
  open: boolean
}
