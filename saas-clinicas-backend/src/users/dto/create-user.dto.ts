import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/validation/decorators.js';
import { UserRole } from '../../generated/prisma/enums.js';

export class CreateUserDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(UserRole)
  role: UserRole;

  /** Repassada à pessoa; precisa ser trocada no primeiro login. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword: string;
}
