import { Module } from '@nestjs/common';
import { ClinicBrandingService } from './clinic-branding.service.js';
import { ClinicsController } from './clinics.controller.js';
import { ClinicsService } from './clinics.service.js';

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, ClinicBrandingService],
  exports: [ClinicsService, ClinicBrandingService],
})
export class ClinicsModule {}
