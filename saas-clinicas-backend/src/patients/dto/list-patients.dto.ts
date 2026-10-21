import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validation/decorators.js';

export class ListPatientsDto {
  /** Nome, nome social ou CPF (com ou sem máscara). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
