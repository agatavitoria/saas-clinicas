import type { UserRole } from '../generated/prisma/enums.js';

/** Usuário de clínica autenticado (preenchido pelo guard a cada requisição). */
export interface AuthUser {
  userId: string;
  tenantId: string;
  /** Papéis atuais (lidos do banco a cada requisição). */
  roles: UserRole[];
}

/** Administrador da plataforma autenticado. */
export interface AuthPlatformAdmin {
  adminId: string;
}

/** Os papéis não vão no token: o guard lê do banco, então mudanças valem na hora. */
export interface TenantAccessTokenPayload {
  sub: string;
  tenantId: string;
}

export interface PlatformAccessTokenPayload {
  sub: string;
}

/** Dados públicos do usuário devolvidos pela API. */
export interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: UserRole[];
  mustChangePassword: boolean;
}

export const USER_PROFILE_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  roles: true,
  mustChangePassword: true,
} as const;

export interface PlatformAdminProfile {
  id: string;
  name: string;
  email: string;
}

export const PLATFORM_ADMIN_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

/** O usuário tem pelo menos um dos papéis informados. */
export const hasRole = (
  user: { roles: readonly UserRole[] },
  ...roles: UserRole[]
): boolean => roles.some((role) => user.roles.includes(role));
