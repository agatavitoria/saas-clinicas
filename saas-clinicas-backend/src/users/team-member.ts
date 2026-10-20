import type { UserRole } from '../generated/prisma/enums.js';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export const TEAM_MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const;
