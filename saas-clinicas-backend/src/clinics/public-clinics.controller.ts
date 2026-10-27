import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { ClinicBrandingService } from './clinic-branding.service.js';
import type { PublicClinicTheme } from './dto/clinic-response.dto.js';
import { sendLogo } from './logo-response.js';

/**
 * Rotas sem sessão, usadas pela tela de login do subdomínio e pela página
 * inicial para conferir se um endereço existe. Não há throttle por IP: no SSR
 * as chamadas chegam todas do servidor do Nuxt.
 */
@Public()
@Controller('public/clinics')
export class PublicClinicsController {
  constructor(private readonly branding: ClinicBrandingService) {}

  @Get(':slug')
  theme(@Param('slug') slug: string): Promise<PublicClinicTheme> {
    return this.branding.getPublicTheme(slug);
  }

  @Get(':slug/logo')
  async logo(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendLogo(res, await this.branding.getPublicLogo(slug));
  }
}
