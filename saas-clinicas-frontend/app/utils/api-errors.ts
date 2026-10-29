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
  CLINIC_READ_ONLY:
    'A exclusão da clínica está agendada: o sistema está somente para consulta até ela ser cancelada.',
  INVALID_DELETION_STATE: 'Esta ação não é possível na situação atual da exclusão. Atualize a página.',
  CONFIRMATION_MISMATCH: 'O nome digitado não confere com o nome da clínica.',
  CPF_IN_USE: 'Já existe um paciente com este CPF nesta clínica.',
  PATIENT_INACTIVE: 'Este paciente está inativo. Reative o cadastro para registrar atendimentos.',
  INVALID_AMENDMENT: 'Adicione o adendo ao registro original, não a outro adendo.',
  NOT_RECORD_AUTHOR: 'Só quem fez o registro (ou um administrador) pode adicionar um adendo.',
  LOW_COLOR_CONTRAST: 'Essa cor é clara demais para textos em branco. Escolha uma cor mais escura.',
  INVALID_LOGO: 'O logo precisa ser uma imagem PNG, JPG ou WebP.',
  INVALID_DATE_RANGE: 'Período inválido. Escolha um intervalo de até 31 dias.',
  INVALID_PROFESSIONAL: 'Escolha um profissional ativo da clínica.',
  APPOINTMENT_CONFLICT: 'O profissional já tem um agendamento neste horário.',
  OUTSIDE_BUSINESS_HOURS: 'O horário fica fora do funcionamento da clínica.',
  APPOINTMENT_IN_PAST: 'Não é possível agendar num horário que já passou.',
  APPOINTMENT_NOT_STARTED: 'Só é possível marcar como realizado ou falta depois do horário do agendamento.',
  APPOINTMENT_NOT_EDITABLE: 'Agendamentos cancelados, realizados ou com falta não podem ser alterados.',
  INVALID_STATUS_TRANSITION: 'Esta mudança de status não é possível. Atualize a agenda.',
  NOT_OWN_APPOINTMENT: 'Você só pode gerenciar a sua própria agenda.',
  LOGO_TOO_LARGE: 'O logo pode ter no máximo 512 KB.',
  SLUG_RESERVED: 'Este endereço é reservado pelo sistema. Escolha outro.',
  SLUG_TAKEN: 'Este endereço já é usado por outra clínica.',
  CLINIC_NOT_FOUND: 'Não encontramos uma clínica com este endereço.',
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
    case 413:
      return 'O arquivo é grande demais.'
    case 429:
      return 'Muitas tentativas. Aguarde um minuto e tente novamente.'
    case undefined:
      return 'Não foi possível conectar ao servidor. Tente novamente em instantes.'
    default:
      return fallback ?? 'Algo deu errado. Tente novamente.'
  }
}
