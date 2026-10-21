import { IsOptional, IsUUID } from 'class-validator';

export class ListRecordsDto {
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
