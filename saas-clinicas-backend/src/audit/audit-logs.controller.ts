import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { type AuditLogPage, AuditLogsService } from './audit-logs.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

/** Histórico da clínica: só administradores, só a própria clínica. */
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAuditLogsDto,
  ): Promise<AuditLogPage> {
    return this.auditLogs.listForTenant(user.tenantId, query);
  }
}
