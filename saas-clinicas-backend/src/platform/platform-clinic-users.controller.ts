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
} from '@nestjs/common';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';
import { ClinicsService } from '../clinics/clinics.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { ResetPasswordDto } from '../users/dto/reset-password.dto.js';
import { SetActiveDto } from '../users/dto/set-active.dto.js';
import type { TeamMember } from '../users/team-member.js';
import { UsersService } from '../users/users.service.js';

/**
 * Equipe de uma clínica, gerida pelo admin master. É o único lugar em que o
 * tenant vem da URL: só a sessão de plataforma chega aqui.
 */
@PlatformRoute()
@Controller('platform/clinics/:clinicId/users')
export class PlatformClinicUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly clinicsService: ClinicsService,
  ) {}

  @Get()
  async findAll(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<TeamMember[]> {
    await this.clinicsService.findOne(clinicId);
    return this.usersService.findAll(clinicId);
  }

  @Post()
  async create(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: CreateUserDto,
  ): Promise<TeamMember> {
    await this.clinicsService.findOne(clinicId);
    return this.usersService.create(clinicId, dto);
  }

  @Patch(':userId/status')
  setActive(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetActiveDto,
  ): Promise<TeamMember> {
    return this.usersService.setActive(clinicId, userId, dto.active);
  }

  @Post(':userId/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<TeamMember> {
    return this.usersService.resetPassword(
      clinicId,
      userId,
      dto.temporaryPassword,
    );
  }
}
