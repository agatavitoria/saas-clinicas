import { Controller, Get, Query } from '@nestjs/common';
import {
  type AuditLogPage,
  AuditLogsService,
} from '../audit/audit-logs.service.js';
import { ListPlatformAuditLogsDto } from '../audit/dto/list-audit-logs.dto.js';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';

/** Histórico de toda a plataforma (master). */
@PlatformRoute()
@Controller('platform/audit-logs')
export class PlatformAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query() query: ListPlatformAuditLogsDto): Promise<AuditLogPage> {
    return this.auditLogs.listAll(query);
  }
}
