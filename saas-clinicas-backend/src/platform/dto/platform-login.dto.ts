import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/validation/decorators.js';

/**
 * Login do master. Aceita um identificador simples além de e-mail (o admin
 * padrão de desenvolvimento entra como "admin"), por isso não exige @IsEmail.
 */
export class PlatformLoginDto {
  @NormalizeEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
