export const statusOf = (error: unknown): number | undefined =>
  (error as { statusCode?: number } | null)?.statusCode

/** Código estável enviado pelo backend (ex.: USER_INACTIVE). */
export const errorCodeOf = (error: unknown): string | undefined =>
  (error as { data?: { code?: string } } | null)?.data?.code

const MESSAGES: Record<string, string> = {
  USER_INACTIVE: 'Seu acesso foi desativado. Fale com o administrador da clínica.',
  CLINIC_INACTIVE: 'O acesso desta clínica está suspenso. Fale com o suporte.',
  EMAIL_IN_USE: 'Este e-mail já está em uso.',
  CANNOT_DEACTIVATE_SELF: 'Você não pode desativar o seu próprio acesso.',
  LAST_ACTIVE_ADMIN: 'A clínica precisa ter pelo menos um administrador ativo.',
  INVALID_CURRENT_PASSWORD: 'A senha atual está incorreta.',
  SAME_PASSWORD: 'A nova senha precisa ser diferente da atual.',
}

/** Mensagem em português para exibir ao usuário. */
export function errorMessage(error: unknown, fallback?: string): string {
  const code = errorCodeOf(error)
  if (code && MESSAGES[code]) return MESSAGES[code]

  switch (statusOf(error)) {
    case 400:
      return fallback ?? 'Alguns dados não foram aceitos. Revise e tente novamente.'
    case 403:
      return 'Você não tem permissão para esta ação.'
    case 404:
      return 'Registro não encontrado.'
    case 429:
      return 'Muitas tentativas. Aguarde um minuto e tente novamente.'
    case undefined:
      return 'Não foi possível conectar ao servidor. Tente novamente em instantes.'
    default:
      return fallback ?? 'Algo deu errado. Tente novamente.'
  }
}
