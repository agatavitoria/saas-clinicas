import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  IsTaxId,
  IsTimeAfter,
  NormalizeEmail,
  OnlyDigits,
  Trim,
} from '../../common/validation/decorators.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ClinicDataDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Somente dígitos: DDD + número (fixo ou celular). */
  @OnlyDigits()
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'phone must have 10 or 11 digits' })
  phone: string;

  @IsOptional()
  @OnlyDigits()
  @IsString()
  @IsTaxId()
  document?: string;
}

export class BusinessHourDto {
  /** 0 = domingo ... 6 = sábado */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @Matches(TIME_PATTERN, { message: 'opensAt must be in HH:mm format' })
  opensAt: string;

  @Matches(TIME_PATTERN, { message: 'closesAt must be in HH:mm format' })
  @IsTimeAfter('opensAt')
  closesAt: string;
}

export class AdminUserDto {
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class CreateClinicDto {
  @ValidateNested()
  @Type(() => ClinicDataDto)
  clinic: ClinicDataDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique((hour: BusinessHourDto) => hour.weekday, {
    message: 'businessHours must not repeat weekdays',
  })
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  businessHours: BusinessHourDto[];

  @ValidateNested()
  @Type(() => AdminUserDto)
  admin: AdminUserDto;
}
