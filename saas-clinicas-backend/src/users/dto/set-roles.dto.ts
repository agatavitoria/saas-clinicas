import { UserRole } from '../../generated/prisma/enums.js';
import { RolesField } from './create-user.dto.js';

export class SetRolesDto {
  @RolesField()
  roles: UserRole[];
}
