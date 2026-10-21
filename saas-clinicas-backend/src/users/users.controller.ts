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
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetActiveDto } from './dto/set-active.dto.js';
import { SetRolesDto } from './dto/set-roles.dto.js';
import type { TeamMember } from './team-member.js';
import { UsersService } from './users.service.js';

/** Equipe da clínica do usuário logado; gestão só para administradores. */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<TeamMember[]> {
    return this.usersService.findAll(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUserDto,
  ): Promise<TeamMember> {
    return this.usersService.create(user.tenantId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  setActive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<TeamMember> {
    return this.usersService.setActive(
      user.tenantId,
      id,
      dto.active,
      user.userId,
    );
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/roles')
  setRoles(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolesDto,
  ): Promise<TeamMember> {
    return this.usersService.setRoles(
      user.tenantId,
      id,
      dto.roles,
      user.userId,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<TeamMember> {
    return this.usersService.resetPassword(
      user.tenantId,
      id,
      dto.temporaryPassword,
    );
  }
}
