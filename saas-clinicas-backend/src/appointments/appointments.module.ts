import { Module } from '@nestjs/common';
import {
  AppointmentsController,
  ProfessionalsController,
} from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  controllers: [AppointmentsController, ProfessionalsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
