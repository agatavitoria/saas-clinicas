import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_DELETION_KEY = 'allowDuringDeletion';

/**
 * Libera uma escrita enquanto a clínica está com a exclusão agendada. Nesse
 * período a clínica fica somente leitura: as demais escritas respondem 403
 * CLINIC_READ_ONLY.
 */
export const AllowDuringDeletion = () =>
  SetMetadata(ALLOW_DURING_DELETION_KEY, true);
