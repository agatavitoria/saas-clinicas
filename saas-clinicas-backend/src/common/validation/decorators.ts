import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidTaxId } from './tax-id.js';

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
