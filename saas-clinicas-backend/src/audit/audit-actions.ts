/**
 * Catálogo de ações auditadas, no formato recurso.verbo_no_passado.
 * Uma ação nova entra aqui (e na tradução do front, app/utils/audit-actions.ts).
 */
export const AUDIT_ACTIONS = [
  // Sessão de clínica
  'auth.logged_in',
  'auth.logged_out',
  'auth.password_changed',
  'auth.session_reuse_detected',
  // Sessão do master
  'platform.logged_in',
  'platform.logged_out',
  // Equipe
  'user.created',
  'user.deactivated',
  'user.reactivated',
  'user.password_reset',
  // Clínica
  'clinic.created',
  'clinic.deactivated',
  'clinic.reactivated',
  // LGPD
  'clinic.data_exported',
  'clinic.deletion_requested',
  'clinic.deletion_cancelled',
  'clinic.deletion_confirmed',
  'clinic.deletion_rejected',
  'clinic.purged',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
