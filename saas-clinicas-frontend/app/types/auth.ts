export type UserRole = 'ADMIN' | 'PROFESSIONAL' | 'RECEPTION'

export interface UserProfile {
  id: string
  tenantId: string
  name: string
  email: string
  role: UserRole
  /** Senha provisória: precisa trocar antes de usar o sistema. */
  mustChangePassword: boolean
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  role: UserRole
  temporaryPassword: string
}

export interface PlatformAdminProfile {
  id: string
  name: string
  email: string
}
