import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ClinicsService } from './clinics.service.js';
import type { ClinicDetails } from './dto/clinic-response.dto.js';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /** Clínica do usuário autenticado. */
  @Get('me')
  findCurrent(@CurrentUser() user: AuthUser): Promise<ClinicDetails> {
    return this.clinicsService.findCurrent(user.tenantId);
  }
}
