/** Situação do pedido de exclusão (LGPD) de uma clínica. */
export type DeletionStatus = 'NONE' | 'REQUESTED' | 'SCHEDULED';

export interface DeletionInfo {
  status: DeletionStatus;
  requestedAt: Date | null;
  scheduledFor: Date | null;
  reason: string | null;
}

export interface DeletionFields {
  deletionRequestedAt: Date | null;
  deletionScheduledFor: Date | null;
  deletionReason: string | null;
}

export const DELETION_FIELDS_SELECT = {
  deletionRequestedAt: true,
  deletionScheduledFor: true,
  deletionReason: true,
} as const;

/** Dias entre a confirmação do master e a exclusão definitiva. */
export const DELETION_GRACE_DAYS = 30;

export function deletionStatus(fields: DeletionFields): DeletionStatus {
  if (fields.deletionScheduledFor) return 'SCHEDULED';
  if (fields.deletionRequestedAt) return 'REQUESTED';
  return 'NONE';
}

export function deletionInfo(fields: DeletionFields): DeletionInfo {
  return {
    status: deletionStatus(fields),
    requestedAt: fields.deletionRequestedAt,
    scheduledFor: fields.deletionScheduledFor,
    reason: fields.deletionReason,
  };
}

/** Separa os campos de exclusão do resto e devolve o resumo `deletion`. */
export function withDeletionInfo<T extends DeletionFields>(
  record: T,
): Omit<T, keyof DeletionFields> & { deletion: DeletionInfo } {
  const { deletionRequestedAt, deletionScheduledFor, deletionReason, ...rest } =
    record;
  return {
    ...rest,
    deletion: deletionInfo({
      deletionRequestedAt,
      deletionScheduledFor,
      deletionReason,
    }),
  };
}
