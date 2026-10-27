import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, SLUG_PATTERN } from '../slug.js';

/**
 * Formato do slug. Nomes reservados e repetidos são conferidos no serviço,
 * que responde com códigos próprios (SLUG_RESERVED, SLUG_TAKEN).
 */
export const IsSlug = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsString(),
    Length(SLUG_MIN_LENGTH, SLUG_MAX_LENGTH),
    Matches(SLUG_PATTERN, {
      message:
        'slug must contain only lowercase letters, digits and inner hyphens',
    }),
  );
