import type { UserRole } from '../generated/prisma/enums.js';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}
