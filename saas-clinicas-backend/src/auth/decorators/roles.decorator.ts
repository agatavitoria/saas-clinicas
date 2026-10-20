import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Restringe a rota de clínica aos papéis informados. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
