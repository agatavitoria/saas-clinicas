import type { UserRole } from '../../generated/prisma/enums.js';

export interface BusinessHourResponse {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface ClinicResponse {
  clinic: {
    id: string;
    name: string;
    email: string;
    phone: string;
    document: string | null;
    businessHours: BusinessHourResponse[];
    createdAt: Date;
  };
  admin: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: UserRole;
  };
}
