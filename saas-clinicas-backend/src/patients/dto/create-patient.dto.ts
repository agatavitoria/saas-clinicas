import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IsBirthDate,
  IsCpf,
  NormalizeEmail,
  OnlyDigits,
  OptionalText,
  Trim,
} from '../../common/validation/decorators.js';
import { Gender } from '../../generated/prisma/enums.js';

const PHONE = /^\d{10,11}$/;

export class CreatePatientDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Somente dígitos (máscara removida). */
  @OnlyDigits()
  @IsString()
  @IsCpf()
  cpf: string;

  /** YYYY-MM-DD */
  @IsBirthDate()
  birthDate: string;

  @IsOptional()
  @OptionalText()
  @IsString()
  @MaxLength(120)
  socialName?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @OnlyDigits()
  @Matches(PHONE, { message: 'phone must have 10 or 11 digits' })
  phone?: string | null;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @OptionalText()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @IsOptional()
  @OnlyDigits()
  @Matches(PHONE, {
    message: 'emergencyContactPhone must have 10 or 11 digits',
  })
  emergencyContactPhone?: string | null;
}
