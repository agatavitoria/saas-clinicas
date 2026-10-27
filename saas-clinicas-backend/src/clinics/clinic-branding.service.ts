import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { badRequest, notFound } from '../common/api-error.js';
import { hasAccessibleContrast, MIN_CONTRAST_RATIO } from '../common/color.js';
import {
  PrismaService,
  type TenantTransactionClient,
} from '../prisma/prisma.service.js';
import {
  CLINIC_BRANDING_SELECT,
  detectLogoMimeType,
  type LogoMimeType,
  MAX_LOGO_BYTES,
} from './branding.js';
import { clinicTarget } from './clinics.service.js';
import type {
  ClinicBrandingInfo,
  PublicClinicTheme,
} from './dto/clinic-response.dto.js';
import { isValidSlug } from './slug.js';

export interface ClinicLogo {
  bytes: Uint8Array;
  mimeType: string;
}

const DEFAULT_BRANDING: ClinicBrandingInfo = {
  primaryColor: null,
  logoUpdatedAt: null,
};

/**
 * Identidade visual da clínica (cor principal e logo). Editada pelo admin da
 * clínica ou pelo master; o tenantId vem do token ou, no master, da URL.
 */
@Injectable()
export class ClinicBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async updateColor(
    tenantId: string,
    primaryColor: string | null,
  ): Promise<ClinicBrandingInfo> {
    if (primaryColor !== null && !hasAccessibleContrast(primaryColor)) {
      throw badRequest(
        'LOW_COLOR_CONTRAST',
        `Primary color needs a contrast ratio of at least ${MIN_CONTRAST_RATIO}:1 with white`,
      );
    }

    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const clinic = await this.findClinic(tx);
      const current = clinic.branding ?? DEFAULT_BRANDING;
      if (current.primaryColor === primaryColor) return current;

      const branding = await tx.clinicBranding.upsert({
        where: { tenantId },
        create: { tenantId, primaryColor },
        update: { primaryColor },
        select: CLINIC_BRANDING_SELECT,
      });
      await this.audit.log(tx, 'clinic.branding_updated', {
        target: clinicTarget(clinic),
        metadata: {
          primaryColor: { from: current.primaryColor, to: primaryColor },
        },
      });
      return branding;
    });
  }

  /** Troca o logo. O corpo da requisição é a própria imagem. */
  async setLogo(tenantId: string, body: unknown): Promise<ClinicBrandingInfo> {
    const { logo, mimeType } = parseLogo(body);

    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const clinic = await this.findClinic(tx);
      const data = { logo, logoMimeType: mimeType, logoUpdatedAt: new Date() };
      const branding = await tx.clinicBranding.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
        select: CLINIC_BRANDING_SELECT,
      });
      await this.audit.log(tx, 'clinic.logo_updated', {
        target: clinicTarget(clinic),
        metadata: { mimeType, sizeBytes: logo.length },
      });
      return branding;
    });
  }

  async removeLogo(tenantId: string): Promise<ClinicBrandingInfo> {
    return this.prisma.tenantTransaction(tenantId, async (tx) => {
      const clinic = await this.findClinic(tx);
      if (!clinic.branding?.logoUpdatedAt) {
        return clinic.branding ?? DEFAULT_BRANDING;
      }

      const branding = await tx.clinicBranding.update({
        where: { tenantId },
        data: { logo: null, logoMimeType: null, logoUpdatedAt: null },
        select: CLINIC_BRANDING_SELECT,
      });
      await this.audit.log(tx, 'clinic.logo_removed', {
        target: clinicTarget(clinic),
      });
      return branding;
    });
  }

  async getLogo(tenantId: string): Promise<ClinicLogo> {
    const branding = await this.prisma
      .forTenant(tenantId)
      .clinicBranding.findUnique({
        where: { tenantId },
        select: { logo: true, logoMimeType: true },
      });
    if (!branding?.logo || !branding.logoMimeType) {
      throw new NotFoundException('Logo not found');
    }
    return { bytes: branding.logo, mimeType: branding.logoMimeType };
  }

  /**
   * Tema da tela de login, buscado pelo subdomínio antes de haver sessão.
   * Clínica inativa ou inexistente dá o mesmo 404, sem diferenciar.
   */
  async getPublicTheme(slug: string): Promise<PublicClinicTheme> {
    const clinic = await this.findActiveBySlug(slug);
    return {
      name: clinic.name,
      slug: clinic.slug,
      ...(clinic.branding ?? DEFAULT_BRANDING),
    };
  }

  async getPublicLogo(slug: string): Promise<ClinicLogo> {
    const clinic = await this.findActiveBySlug(slug);
    return this.getLogo(clinic.id);
  }

  /**
   * Busca sem tenant: o slug é justamente o que identifica a clínica. Só
   * devolve o que a tela de login pública pode mostrar.
   */
  private async findActiveBySlug(slug: string) {
    const clinic = isValidSlug(slug)
      ? await this.prisma.clinic.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            slug: true,
            active: true,
            branding: { select: CLINIC_BRANDING_SELECT },
          },
        })
      : null;
    if (!clinic?.active) {
      throw notFound('CLINIC_NOT_FOUND', 'Clinic not found');
    }
    return clinic;
  }

  /** Clínica da transação (o RLS já restringe ao tenant). */
  private async findClinic(tx: TenantTransactionClient) {
    const clinic = await tx.clinic.findFirst({
      select: {
        id: true,
        name: true,
        branding: { select: CLINIC_BRANDING_SELECT },
      },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }
}

function parseLogo(body: unknown): {
  logo: Uint8Array<ArrayBuffer>;
  mimeType: LogoMimeType;
} {
  if (!(body instanceof Uint8Array) || body.length === 0) {
    throw badRequest(
      'INVALID_LOGO',
      'Send a PNG, JPEG or WebP image as the request body',
    );
  }
  if (body.length > MAX_LOGO_BYTES) {
    throw badRequest(
      'LOGO_TOO_LARGE',
      `Logo must be at most ${MAX_LOGO_BYTES / 1024} KB`,
    );
  }
  const mimeType = detectLogoMimeType(body);
  if (!mimeType) {
    throw badRequest('INVALID_LOGO', 'Logo must be a PNG, JPEG or WebP image');
  }
  return { logo: Uint8Array.from(body), mimeType };
}
