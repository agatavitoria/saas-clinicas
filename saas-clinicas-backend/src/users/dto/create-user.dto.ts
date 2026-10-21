import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/validation/decorators.js';
import { UserRole } from '../../generated/prisma/enums.js';

/** Lista de papéis: pelo menos um, sem repetição. */
export function RolesField(): PropertyDecorator {
  const decorators = [
    IsArray(),
    ArrayNotEmpty(),
    ArrayUnique(),
    ArrayMaxSize(Object.keys(UserRole).length),
    IsEnum(UserRole, { each: true }),
  ];
  return (target, key) =>
    decorators.forEach((decorate) => decorate(target, key));
}

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

  /** Ex.: ['ADMIN', 'PROFESSIONAL'] para quem administra e também atende. */
  @RolesField()
  roles: UserRole[];

  /** Repassada à pessoa; precisa ser trocada no primeiro login. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword: string;
}
