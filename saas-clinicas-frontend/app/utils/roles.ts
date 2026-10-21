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

/** Ordem de exibição (e de importância para a cor do avatar). */
export const ROLE_ORDER: UserRole[] = ['ADMIN', 'PROFESSIONAL', 'RECEPTION']

export const ROLE_OPTIONS = ROLE_ORDER.map(value => ({ value, title: ROLE_LABELS[value] }))

export const sortRoles = (roles: readonly UserRole[]) =>
  ROLE_ORDER.filter(role => roles.includes(role))

/** Papel principal, usado na cor do avatar. */
export const primaryRole = (roles: readonly UserRole[]): UserRole =>
  sortRoles(roles)[0] ?? 'RECEPTION'

export const rolesLabel = (roles: readonly UserRole[]) =>
  sortRoles(roles).map(role => ROLE_LABELS[role]).join(', ')

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
