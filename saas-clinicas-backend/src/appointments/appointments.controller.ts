import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type {
  AppointmentView,
  ProfessionalOption,
} from './appointment.types.js';
import { AppointmentsService } from './appointments.service.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { ListAppointmentsDto } from './dto/list-appointments.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';

/**
 * Agenda da clínica do usuário logado. Todos os papéis consultam; recepção
 * e admin gerenciam qualquer agenda, e o profissional só a própria (regra
 * aplicada no service, pois depende do agendamento).
 */
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAppointmentsDto,
  ): Promise<AppointmentView[]> {
    return this.appointments.list(user.tenantId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentView> {
    return this.appointments.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ): Promise<AppointmentView> {
    return this.appointments.update(user, id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<AppointmentView> {
    return this.appointments.changeStatus(user, id, dto);
  }
}

/** Profissionais que podem receber agendamentos (todos os papéis consultam). */
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ProfessionalOption[]> {
    return this.appointments.listProfessionals(user.tenantId);
  }
}
