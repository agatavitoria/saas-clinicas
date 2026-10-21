import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { AllowDuringDeletion } from '../auth/decorators/allow-during-deletion.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { ClinicDetails } from '../clinics/dto/clinic-response.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
import { RequestDeletionDto } from './dto/request-deletion.dto.js';
import { sendAsDownload } from './export-response.js';
import { type ClinicExport, PrivacyService } from './privacy.service.js';

/** Privacidade (LGPD) da clínica do admin logado. */
@Roles(UserRole.ADMIN)
@Controller('clinics/me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClinicExport> {
    return sendAsDownload(
      res,
      await this.privacy.exportClinic(user.tenantId, {
        includeHealthData: true,
      }),
    );
  }

  @Post('deletion-request')
  @HttpCode(HttpStatus.OK)
  requestDeletion(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestDeletionDto,
  ): Promise<ClinicDetails> {
    return this.privacy.requestDeletion(user.tenantId, user.userId, dto);
  }

  /** Desiste do pedido, inclusive durante a carência (somente leitura). */
  @AllowDuringDeletion()
  @Delete('deletion-request')
  cancelRequest(@CurrentUser() user: AuthUser): Promise<ClinicDetails> {
    return this.privacy.cancelRequest(user.tenantId);
  }
}
