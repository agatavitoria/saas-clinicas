import { Global, Module } from '@nestjs/common';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsService } from './audit-logs.service.js';
import { AuditService } from './audit.service.js';

/** Contexto da requisição (AsyncLocalStorage) + serviço de auditoria. */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          cls.set('ip', req.ip);
          cls.set('userAgent', req.headers['user-agent']);
        },
      },
    }),
  ],
  controllers: [AuditLogsController],
  providers: [AuditService, AuditLogsService],
  exports: [AuditService, AuditLogsService],
})
export class AuditModule {}
