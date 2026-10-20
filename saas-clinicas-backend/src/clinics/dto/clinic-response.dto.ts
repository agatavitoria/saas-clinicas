import type { UserProfile } from '../../auth/auth-user.js';

export interface BusinessHourResponse {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface ClinicDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string | null;
  active: boolean;
  businessHours: BusinessHourResponse[];
  createdAt: Date;
}

export interface ClinicSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  usersCount: number;
  createdAt: Date;
}

export interface ClinicResponse {
  clinic: ClinicDetails;
  admin: UserProfile;
}
