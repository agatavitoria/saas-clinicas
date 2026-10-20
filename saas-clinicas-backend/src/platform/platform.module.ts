import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClinicsModule } from '../clinics/clinics.module.js';
import { UsersModule } from '../users/users.module.js';
import { PlatformAuthController } from './platform-auth.controller.js';
import { PlatformAuthService } from './platform-auth.service.js';
import { PlatformClinicUsersController } from './platform-clinic-users.controller.js';
import { PlatformClinicsController } from './platform-clinics.controller.js';

@Module({
  imports: [AuthModule, ClinicsModule, UsersModule],
  controllers: [
    PlatformAuthController,
    PlatformClinicsController,
    PlatformClinicUsersController,
  ],
  providers: [PlatformAuthService],
})
export class PlatformModule {}
