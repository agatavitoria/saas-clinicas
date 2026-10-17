export type UserRole = 'ADMIN' | 'PROFESSIONAL' | 'RECEPTION'

export interface UserProfile {
  id: string
  tenantId: string
  name: string
  email: string
  role: UserRole
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}
