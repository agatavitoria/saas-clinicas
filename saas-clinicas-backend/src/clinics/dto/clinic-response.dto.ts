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
  /** Subdomínio pelo qual a equipe acessa o sistema. */
  slug: string;
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
  slug: string;
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

/** Tema da tela de login, público: só o que a página precisa exibir. */
export interface PublicClinicTheme {
  name: string;
  slug: string;
  primaryColor: string | null;
  logoUpdatedAt: Date | null;
}
