import type { UserRole } from '../generated/prisma/enums.js';

/** Usuário de clínica autenticado (preenchido pelo guard a cada requisição). */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: UserRole;
}

/** Administrador da plataforma autenticado. */
export interface AuthPlatformAdmin {
  adminId: string;
}

export interface TenantAccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
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
  role: UserRole;
  mustChangePassword: boolean;
}

export const USER_PROFILE_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  role: true,
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
