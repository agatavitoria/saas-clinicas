import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ClinicBrandingService } from './clinic-branding.service.js';
import { ClinicsService } from './clinics.service.js';
import type {
  ClinicBrandingInfo,
  ClinicDetails,
} from './dto/clinic-response.dto.js';
import { UpdateBrandingDto } from './dto/update-branding.dto.js';
import { UpdateBusinessHoursDto } from './dto/update-business-hours.dto.js';
import { UpdateClinicDto } from './dto/update-clinic.dto.js';
import { UpdateScheduleSettingsDto } from './dto/update-schedule-settings.dto.js';
import { sendLogo } from './logo-response.js';

@Controller('clinics')
export class ClinicsController {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly branding: ClinicBrandingService,
  ) {}

  /** Clínica do usuário autenticado. */
  @Get('me')
  findCurrent(@CurrentUser() user: AuthUser): Promise<ClinicDetails> {
    return this.clinicsService.findCurrent(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('me')
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateClinicDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.rename(user.tenantId, dto.name);
  }

  @Roles(UserRole.ADMIN)
  @Patch('me/schedule-settings')
  updateScheduleSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateScheduleSettingsDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.updateScheduleSettings(user.tenantId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Put('me/business-hours')
  updateBusinessHours(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBusinessHoursDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.updateBusinessHours(
      user.tenantId,
      dto.businessHours,
    );
  }

  /** Logo da clínica, exibido para toda a equipe. */
  @Get('me/logo')
  async logo(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendLogo(res, await this.branding.getLogo(user.tenantId));
  }

  @Roles(UserRole.ADMIN)
  @Patch('me/branding')
  updateBranding(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBrandingDto,
  ): Promise<ClinicBrandingInfo> {
    return this.branding.updateColor(user.tenantId, dto.primaryColor);
  }

  /** O corpo é a própria imagem (Content-Type image/png, jpeg ou webp). */
  @Roles(UserRole.ADMIN)
  @Put('me/branding/logo')
  setLogo(
    @CurrentUser() user: AuthUser,
    @Body() body: Buffer,
  ): Promise<ClinicBrandingInfo> {
    return this.branding.setLogo(user.tenantId, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete('me/branding/logo')
  removeLogo(@CurrentUser() user: AuthUser): Promise<ClinicBrandingInfo> {
    return this.branding.removeLogo(user.tenantId);
  }
}
