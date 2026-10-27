import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidCpf, isValidTaxId } from './tax-id.js';

/** Remove espaços nas pontas. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Normaliza e-mail: sem espaços e em minúsculas. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** Mantém apenas dígitos (telefone, CPF/CNPJ). */
export const OnlyDigits = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  );

export function IsTaxId(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isTaxId',
      target: object.constructor,
      propertyName,
      options: { message: '$property must be a valid CPF or CNPJ', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidTaxId(value),
      },
    });
  };
}

/** Texto opcional: espaços nas pontas removidos e vazio vira null (limpa o campo). */
export const OptionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

export function IsCpf(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: { message: '$property must be a valid CPF', ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCpf(value),
      },
    });
  };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MIN_BIRTH_YEAR = 1900;

/** Data de nascimento no formato YYYY-MM-DD, existente e não futura. */
export function IsBirthDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isBirthDate',
      target: object.constructor,
      propertyName,
      options: {
        message: '$property must be a valid past date (YYYY-MM-DD)',
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
          const date = new Date(`${value}T00:00:00Z`);
          return (
            !Number.isNaN(date.getTime()) &&
            // Rejeita datas que "transbordam", como 2024-02-31
            date.toISOString().startsWith(value) &&
            date.getUTCFullYear() >= MIN_BIRTH_YEAR &&
            date.getTime() <= Date.now()
          );
        },
      },
    });
  };
}

/** Garante que o horário (HH:mm) seja posterior ao de outra propriedade. */
export function IsTimeAfter(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isTimeAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `$property must be later than ${property}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [related] = args.constraints as [string];
          const other = (args.object as Record<string, unknown>)[related];
          return (
            typeof value === 'string' &&
            typeof other === 'string' &&
            value > other
          );
        },
      },
    });
  };
}

/** Nomes canônicos dos fusos IANA que o runtime conhece (ex.: America/Sao_Paulo). */
const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

export function IsIanaTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options: {
        message: '$property must be an IANA time zone (e.g. America/Sao_Paulo)',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && TIME_ZONES.has(value),
      },
    });
  };
}
