import type { ClsStore } from 'nestjs-cls';
import type { AuditActorType } from '../generated/prisma/enums.js';

/** Quem executa a ação. */
export interface AuditActor {
  type: AuditActorType;
  id: string | null;
  label: string;
  /** Clínica do ator (null para o master e para o sistema). */
  tenantId: string | null;
}

/** Contexto da requisição, guardado em AsyncLocalStorage (nestjs-cls). */
export interface AuditClsStore extends ClsStore {
  actor?: AuditActor;
  ip?: string;
  userAgent?: string;
}

export const SYSTEM_ACTOR: AuditActor = {
  type: 'SYSTEM',
  id: null,
  label: 'Sistema',
  tenantId: null,
};
