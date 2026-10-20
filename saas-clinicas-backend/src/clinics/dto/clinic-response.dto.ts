import type { UserProfile } from '../../auth/auth-user.js';
import type { DeletionInfo } from '../../privacy/deletion-status.js';

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
  deletion: DeletionInfo;
  createdAt: Date;
}

export interface ClinicSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  usersCount: number;
  deletion: DeletionInfo;
  createdAt: Date;
}

export interface ClinicResponse {
  clinic: ClinicDetails;
  admin: UserProfile;
}
