import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { SetActiveDto } from '../users/dto/set-active.dto.js';
import { CreatePatientDto } from './dto/create-patient.dto.js';
import {
  CreateAmendmentDto,
  CreateRecordDto,
} from './dto/create-record.dto.js';
import { ListPatientsDto } from './dto/list-patients.dto.js';
import { ListRecordsDto } from './dto/list-records.dto.js';
import { UpdatePatientDto } from './dto/update-patient.dto.js';
import { PatientRecordsService } from './patient-records.service.js';
import type {
  PatientDetails,
  PatientPage,
  PatientRecordEntry,
  PatientRecordWithAmendments,
} from './patient.types.js';
import { PatientsService } from './patients.service.js';

/**
 * Pacientes da clínica do usuário logado.
 * - Consultar (lista, ficha, atendimentos): todos os papéis.
 * - Cadastrar, editar e inativar: recepção e admin.
 * - Registrar atendimento e adendo: profissional e admin.
 */
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly records: PatientRecordsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPatientsDto,
  ): Promise<PatientPage> {
    return this.patients.list(user.tenantId, query);
  }

  @Roles(UserRole.RECEPTION, UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePatientDto,
  ): Promise<PatientDetails> {
    return this.patients.create(user.tenantId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PatientDetails> {
    return this.patients.findOne(user.tenantId, id);
  }

  @Roles(UserRole.RECEPTION, UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientDetails> {
    return this.patients.update(user.tenantId, id, dto);
  }

  @Roles(UserRole.RECEPTION, UserRole.ADMIN)
  @Patch(':id/status')
  setActive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<PatientDetails> {
    return this.patients.setActive(user.tenantId, id, dto.active);
  }

  @Get(':id/records')
  listRecords(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRecordsDto,
  ): Promise<PatientRecordWithAmendments[]> {
    return this.records.list(user.tenantId, id, query);
  }

  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @Post(':id/records')
  createRecord(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRecordDto,
  ): Promise<PatientRecordWithAmendments> {
    return this.records.create(user, id, dto);
  }

  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @Post(':id/records/:recordId/amendments')
  amend(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: CreateAmendmentDto,
  ): Promise<PatientRecordEntry> {
    return this.records.amend(user, id, recordId, dto);
  }
}
