import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthCookiesService } from '../auth/auth-cookies.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ClinicsService } from './clinics.service.js';
import type {
  ClinicDetails,
  ClinicResponse,
} from './dto/clinic-response.dto.js';
import { CreateClinicDto } from './dto/create-clinic.dto.js';

@Controller('clinics')
export class ClinicsController {
  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly authService: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  /** Cadastro público: cria a clínica e o administrador, já autenticado. */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateClinicDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClinicResponse> {
    const created = await this.clinicsService.create(dto);
    this.cookies.set(res, await this.authService.createSession(created.admin));
    return created;
  }

  /** Clínica do usuário autenticado. */
  @Get('me')
  findCurrent(@CurrentUser() user: AuthUser): Promise<ClinicDetails> {
    return this.clinicsService.findCurrent(user.tenantId);
  }
}
