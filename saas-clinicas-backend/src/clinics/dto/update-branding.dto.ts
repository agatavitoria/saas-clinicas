import { Transform } from 'class-transformer';
import { IsString, Matches, ValidateIf } from 'class-validator';
import { HEX_COLOR_PATTERN } from '../../common/color.js';

export class UpdateBrandingDto {
  /** #RRGGBB; null volta para a cor padrão do sistema. */
  @ValidateIf((dto: UpdateBrandingDto) => dto.primaryColor !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'primaryColor must be in #RRGGBB format',
  })
  primaryColor: string | null;
}
