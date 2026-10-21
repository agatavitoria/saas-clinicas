import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import {
  IsBirthDate,
  IsCpf,
  OnlyDigits,
  Trim,
} from '../../common/validation/decorators.js';
import { CreatePatientDto } from './create-patient.dto.js';

/** Valida se o campo foi enviado; null não é aceito nos obrigatórios. */
const IfPresent = () => ValidateIf((_object, value) => value !== undefined);

/**
 * Edição parcial. Nos campos opcionais, null (ou texto vazio) limpa o valor;
 * nome, CPF e data de nascimento não podem ser limpos.
 */
export class UpdatePatientDto extends PartialType(
  OmitType(CreatePatientDto, ['name', 'cpf', 'birthDate'] as const),
) {
  @IfPresent()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IfPresent()
  @OnlyDigits()
  @IsString()
  @IsCpf()
  cpf?: string;

  @IfPresent()
  @IsBirthDate()
  birthDate?: string;
}
