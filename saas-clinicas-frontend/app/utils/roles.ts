import type { UserRole } from '~/types/auth'

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  RECEPTION: 'Recepção',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'primary',
  PROFESSIONAL: 'tertiary',
  RECEPTION: 'secondary',
}

/** Iniciais para o avatar: "Ana Souza" → "AS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}
