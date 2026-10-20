import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM_ROUTE_KEY = 'isPlatformRoute';

/** Rota do admin master: exige a sessão de plataforma, não a de clínica. */
export const PlatformRoute = () => SetMetadata(IS_PLATFORM_ROUTE_KEY, true);
