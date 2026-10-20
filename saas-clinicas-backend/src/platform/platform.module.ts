import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicsModule } from '../clinics/clinics.module.js';
import { PrivacyModule } from '../privacy/privacy.module.js';
import { UsersModule } from '../users/users.module.js';
import { PlatformAuditLogsController } from './platform-audit-logs.controller.js';
import { PlatformAuthController } from './platform-auth.controller.js';
import { PlatformAuthService } from './platform-auth.service.js';
import { PlatformClinicUsersController } from './platform-clinic-users.controller.js';
import { PlatformClinicsController } from './platform-clinics.controller.js';

@Module({
  imports: [AuthModule, ClinicsModule, UsersModule, PrivacyModule],
  controllers: [
    PlatformAuthController,
    PlatformClinicsController,
    PlatformClinicUsersController,
    PlatformAuditLogsController,
  ],
  providers: [PlatformAuthService],
})
export class PlatformModule {}
