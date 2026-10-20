import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type AuditLogPage,
  AuditLogsService,
} from '../audit/audit-logs.service.js';
import { ListAuditLogsDto } from '../audit/dto/list-audit-logs.dto.js';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';
import { ClinicsService } from '../clinics/clinics.service.js';
import type {
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from '../clinics/dto/clinic-response.dto.js';
import { CreateClinicDto } from '../clinics/dto/create-clinic.dto.js';
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

  @Patch(':id/status')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<ClinicDetails> {
    return this.clinicsService.setActive(id, dto.active);
  }

  @Get(':id/audit-logs')
  async auditLogsOf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAuditLogsDto,
  ): Promise<AuditLogPage> {
    await this.clinicsService.findOne(id);
    return this.auditLogs.listForTenant(id, query);
  }

  @Get(':id/export')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClinicExport> {
    return sendAsDownload(res, await this.privacy.exportClinic(id));
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
