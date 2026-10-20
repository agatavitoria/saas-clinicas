export type AuditActorType = 'USER' | 'PLATFORM_ADMIN' | 'SYSTEM'

export interface AuditLogEntry {
  id: string
  occurredAt: string
  action: string
  tenantId: string | null
  /** Só na visão do master; null se a clínica foi excluída. */
  clinicName?: string | null
  actor: { type: AuditActorType, id: string | null, label: string }
  target: { type: string, id: string | null, label: string | null } | null
  metadata: Record<string, unknown>
  ip: string | null
}

export interface AuditLogPage {
  items: AuditLogEntry[]
  nextCursor: string | null
}
