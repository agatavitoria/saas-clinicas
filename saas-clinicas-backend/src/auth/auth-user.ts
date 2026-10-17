import type { UserRole } from '../generated/prisma/enums.js';

/** Usuário autenticado, extraído do access token. */
export interface AuthUser {
  userId: string;
  tenantId: string;
  role: UserRole;
}

/** Payload assinado no access token. */
export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
}

/** Dados públicos do usuário devolvidos pela API. */
export interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
}

export const USER_PROFILE_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  role: true,
} as const;
