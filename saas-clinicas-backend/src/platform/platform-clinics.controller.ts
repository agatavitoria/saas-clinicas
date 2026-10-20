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
} from '@nestjs/common';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';
import { ClinicsService } from '../clinics/clinics.service.js';
import type {
  ClinicDetails,
  ClinicResponse,
  ClinicSummary,
} from '../clinics/dto/clinic-response.dto.js';
import { CreateClinicDto } from '../clinics/dto/create-clinic.dto.js';
import { SetActiveDto } from '../users/dto/set-active.dto.js';

/** Gestão de clínicas pelo admin master. */
@PlatformRoute()
@Controller('platform/clinics')
export class PlatformClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

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
}
