import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module.js';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';
import { PurgeService } from './purge.service.js';

@Module({
  imports: [ClinicsModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, PurgeService],
  exports: [PrivacyService, PurgeService],
})
export class PrivacyModule {}
