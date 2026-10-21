import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClinicsModule } from './clinics/clinics.module.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    ClinicsModule,
    UsersModule,
    PatientsModule,
    PlatformModule,
    PrivacyModule,
  ],
})
export class AppModule {}
