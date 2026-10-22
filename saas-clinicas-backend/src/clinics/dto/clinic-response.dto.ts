import type { UserProfile } from '../../auth/auth-user.js';
import type { DeletionInfo } from '../../privacy/deletion-status.js';

export interface BusinessHourResponse {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

/** Identidade visual; null quando a clínica usa o padrão do sistema. */
export interface ClinicBrandingInfo {
  primaryColor: string | null;
  /** null = sem logo. Muda a cada troca, para invalidar o cache da imagem. */
  logoUpdatedAt: Date | null;
}

export interface ClinicDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string | null;
  active: boolean;
  businessHours: BusinessHourResponse[];
  branding: ClinicBrandingInfo | null;
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
  /** Só a quantidade: o master não vê dados de pacientes. */
  patientsCount: number;
  deletion: DeletionInfo;
  createdAt: Date;
}

export interface ClinicResponse {
  clinic: ClinicDetails;
  admin: UserProfile;
}
