import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ClinicsService } from './clinics.service.js';
import type { ClinicResponse } from './dto/clinic-response.dto.js';
import { CreateClinicDto } from './dto/create-clinic.dto.js';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /** Cadastro público: cria a clínica e o administrador dela. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateClinicDto): Promise<ClinicResponse> {
    return this.clinicsService.create(dto);
  }
}
