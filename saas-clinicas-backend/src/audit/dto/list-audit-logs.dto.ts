import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AUDIT_ACTIONS, type AuditAction } from '../audit-actions.js';

export class ListAuditLogsDto {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Início do período (inclusive), ISO 8601. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fim do período (exclusive), ISO 8601. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Valor `nextCursor` da página anterior. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Filtros do master: também pode filtrar por clínica. */
export class ListPlatformAuditLogsDto extends ListAuditLogsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
