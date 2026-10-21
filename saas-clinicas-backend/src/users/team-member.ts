import type { UserRole } from '../generated/prisma/enums.js';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export const TEAM_MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  roles: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const;
