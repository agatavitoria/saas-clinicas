import { Module } from '@nestjs/common';
import { ClinicBrandingService } from './clinic-branding.service.js';
import { ClinicsController } from './clinics.controller.js';
import { ClinicsService } from './clinics.service.js';
import { PublicClinicsController } from './public-clinics.controller.js';

@Module({
  controllers: [ClinicsController, PublicClinicsController],
  providers: [ClinicsService, ClinicBrandingService],
  exports: [ClinicsService, ClinicBrandingService],
})
export class ClinicsModule {}
