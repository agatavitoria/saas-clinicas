import { Module } from '@nestjs/common';
import { PatientRecordsService } from './patient-records.service.js';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientRecordsService],
  exports: [PatientsService],
})
export class PatientsModule {}
