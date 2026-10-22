import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Delete,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type AuditLogPage,
  AuditLogsService,
} from '../audit/audit-logs.service.js';
import { ListAuditLogsDto } from '../audit/dto/list-audit-logs.dto.js';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';
import { ClinicBrandingService } from '../clinics/clinic-branding.service.js';
import { ClinicsService } from '../clinics/clinics.service.js';
import type {
  ClinicBrandingInfo,
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from '../clinics/dto/clinic-response.dto.js';
import { CreateClinicDto } from '../clinics/dto/create-clinic.dto.js';
import { UpdateBrandingDto } from '../clinics/dto/update-branding.dto.js';
import { UpdateClinicDto } from '../clinics/dto/update-clinic.dto.js';
import { sendLogo } from '../clinics/logo-response.js';
import { sendAsDownload } from '../privacy/export-response.js';
import {
  type ClinicExport,
  PrivacyService,
} from '../privacy/privacy.service.js';
import { SetActiveDto } from '../users/dto/set-active.dto.js';

/** Gestão de clínicas pelo admin master. */
@PlatformRoute()
@Controller('platform/clinics')
export class PlatformClinicsController {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly branding: ClinicBrandingService,
    private readonly privacy: PrivacyService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  findAll(): Promise<ClinicSummary[]> {
    return this.clinicsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateClinicDto): Promise<ClinicResponse> {
    return this.clinicsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ClinicDetails> {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.rename(id, dto.name);
  }

  @Patch(':id/status')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.setActive(id, dto.active);
  }

  @Get(':id/logo')
  async logo(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendLogo(res, await this.branding.getLogo(id));
  }

  @Patch(':id/branding')
  updateBranding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingDto,
  ): Promise<ClinicBrandingInfo> {
    return this.branding.updateColor(id, dto.primaryColor);
  }

  /** O corpo é a própria imagem (Content-Type image/png, jpeg ou webp). */
  @Put(':id/branding/logo')
  setLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Buffer,
  ): Promise<ClinicBrandingInfo> {
    return this.branding.setLogo(id, body);
  }

  @Delete(':id/branding/logo')
  removeLogo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClinicBrandingInfo> {
    return this.branding.removeLogo(id);
  }

  @Get(':id/audit-logs')
  async auditLogsOf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAuditLogsDto,
  ): Promise<AuditLogPage> {
    await this.clinicsService.findOne(id);
    return this.auditLogs.listForTenant(id, query, { redactPatients: true });
  }

  @Get(':id/export')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClinicExport> {
    // O master não recebe dados de saúde: só a quantidade de pacientes
    return sendAsDownload(
      res,
      await this.privacy.exportClinic(id, { includeHealthData: false }),
    );
  }

  /** Confirma o pedido do admin: exclusão definitiva em 30 dias. */
  @Post(':id/deletion/confirm')
  @HttpCode(HttpStatus.OK)
  confirmDeletion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClinicDetails> {
    return this.privacy.confirmDeletion(id);
  }

  @Post(':id/deletion/reject')
  @HttpCode(HttpStatus.OK)
  rejectDeletion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClinicDetails> {
    return this.privacy.rejectDeletion(id);
  }

  /** Cancela durante a carência e reativa a clínica. */
  @Post(':id/deletion/cancel')
  @HttpCode(HttpStatus.OK)
  cancelDeletion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClinicDetails> {
    return this.privacy.cancelScheduledDeletion(id);
  }
}
