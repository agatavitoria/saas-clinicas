import type { AppointmentStatus } from '~/types/appointment'
import type { AuditLogEntry } from '~/types/audit'
import type { UserRole } from '~/types/auth'

interface ActionInfo {
  /** Nome do filtro, ex.: "Usuário desativado" */
  label: string
  icon: string
  color: string
  /** Complemento depois do nome do ator; `{target}` vira o alvo em negrito. */
  sentence: string
}

/** Tradução do catálogo de ações do backend (src/audit/audit-actions.ts). */
export const AUDIT_ACTIONS: Record<string, ActionInfo> = {
  'auth.logged_in': { label: 'Login', icon: 'mdi-login', color: 'primary', sentence: 'entrou no sistema' },
  'auth.logged_out': { label: 'Logout', icon: 'mdi-logout', color: 'secondary', sentence: 'saiu do sistema' },
  'auth.password_changed': { label: 'Senha trocada', icon: 'mdi-lock-reset', color: 'secondary', sentence: 'trocou a própria senha' },
  'auth.session_reuse_detected': {
    label: 'Sessão suspeita',
    icon: 'mdi-shield-alert-outline',
    color: 'error',
    sentence: 'encerrou as sessões de {target} por reutilização suspeita de token',
  },
  'platform.logged_in': { label: 'Login do master', icon: 'mdi-shield-crown-outline', color: 'tertiary', sentence: 'entrou na administração da plataforma' },
  'platform.logged_out': { label: 'Logout do master', icon: 'mdi-logout', color: 'tertiary', sentence: 'saiu da administração da plataforma' },
  'user.created': { label: 'Usuário criado', icon: 'mdi-account-plus-outline', color: 'success', sentence: 'criou o usuário {target}' },
  'user.deactivated': { label: 'Usuário desativado', icon: 'mdi-account-off-outline', color: 'error', sentence: 'desativou o usuário {target}' },
  'user.reactivated': { label: 'Usuário reativado', icon: 'mdi-account-check-outline', color: 'success', sentence: 'reativou o usuário {target}' },
  'user.roles_changed': { label: 'Papéis alterados', icon: 'mdi-badge-account-outline', color: 'primary', sentence: 'alterou os papéis de {target}' },
  'user.password_reset': { label: 'Senha redefinida', icon: 'mdi-key-change', color: 'warning', sentence: 'redefiniu a senha de {target}' },
  'clinic.created': { label: 'Clínica criada', icon: 'mdi-domain-plus', color: 'success', sentence: 'criou a clínica {target}' },
  'clinic.deactivated': { label: 'Clínica desativada', icon: 'mdi-domain-off', color: 'error', sentence: 'desativou a clínica {target}' },
  'clinic.reactivated': { label: 'Clínica reativada', icon: 'mdi-domain', color: 'success', sentence: 'reativou a clínica {target}' },
  'clinic.renamed': { label: 'Clínica renomeada', icon: 'mdi-rename-outline', color: 'primary', sentence: 'renomeou a clínica para {target}' },
  'clinic.branding_updated': { label: 'Cor alterada', icon: 'mdi-palette-outline', color: 'primary', sentence: 'alterou a cor principal de {target}' },
  'clinic.logo_updated': { label: 'Logo alterado', icon: 'mdi-image-edit-outline', color: 'primary', sentence: 'alterou o logo de {target}' },
  'clinic.logo_removed': { label: 'Logo removido', icon: 'mdi-image-remove-outline', color: 'secondary', sentence: 'removeu o logo de {target}' },
  'clinic.schedule_settings_updated': { label: 'Agenda configurada', icon: 'mdi-calendar-clock-outline', color: 'primary', sentence: 'alterou o fuso ou a duração padrão da agenda de {target}' },
  'clinic.business_hours_updated': { label: 'Horário alterado', icon: 'mdi-clock-edit-outline', color: 'primary', sentence: 'alterou o horário de funcionamento de {target}' },
  'patient.created': { label: 'Paciente cadastrado', icon: 'mdi-account-heart-outline', color: 'success', sentence: 'cadastrou o paciente {target}' },
  'patient.updated': { label: 'Paciente editado', icon: 'mdi-account-edit-outline', color: 'primary', sentence: 'editou o cadastro de {target}' },
  'patient.viewed': { label: 'Ficha consultada', icon: 'mdi-eye-outline', color: 'secondary', sentence: 'abriu a ficha de {target}' },
  'patient.deactivated': { label: 'Paciente inativado', icon: 'mdi-account-off-outline', color: 'error', sentence: 'inativou o paciente {target}' },
  'patient.reactivated': { label: 'Paciente reativado', icon: 'mdi-account-check-outline', color: 'success', sentence: 'reativou o paciente {target}' },
  'patient_record.created': { label: 'Atendimento registrado', icon: 'mdi-clipboard-text-outline', color: 'primary', sentence: 'registrou um atendimento de {target}' },
  'patient_record.amended': { label: 'Adendo no prontuário', icon: 'mdi-clipboard-edit-outline', color: 'warning', sentence: 'adicionou um adendo ao prontuário de {target}' },
  'appointment.created': { label: 'Agendamento criado', icon: 'mdi-calendar-plus', color: 'success', sentence: 'agendou um horário para {target}' },
  'appointment.rescheduled': { label: 'Agendamento remarcado', icon: 'mdi-calendar-edit', color: 'primary', sentence: 'remarcou o horário de {target}' },
  'appointment.updated': { label: 'Agendamento editado', icon: 'mdi-calendar-text', color: 'secondary', sentence: 'editou a observação do agendamento de {target}' },
  'appointment.status_changed': { label: 'Status do agendamento', icon: 'mdi-calendar-sync', color: 'primary', sentence: 'alterou o status do agendamento de {target}' },
  'clinic.data_exported': { label: 'Dados exportados', icon: 'mdi-download', color: 'primary', sentence: 'exportou os dados da clínica {target}' },
  'clinic.deletion_requested': { label: 'Exclusão solicitada', icon: 'mdi-delete-clock-outline', color: 'warning', sentence: 'solicitou a exclusão da clínica {target}' },
  'clinic.deletion_cancelled': { label: 'Exclusão cancelada', icon: 'mdi-delete-restore', color: 'success', sentence: 'cancelou a exclusão da clínica {target}' },
  'clinic.deletion_confirmed': { label: 'Exclusão confirmada', icon: 'mdi-delete-alert-outline', color: 'error', sentence: 'confirmou a exclusão da clínica {target}' },
  'clinic.deletion_rejected': { label: 'Exclusão recusada', icon: 'mdi-delete-off-outline', color: 'secondary', sentence: 'recusou o pedido de exclusão da clínica {target}' },
  'clinic.purged': { label: 'Dados excluídos', icon: 'mdi-delete-forever-outline', color: 'error', sentence: 'excluiu definitivamente os dados da clínica' },
}

const FALLBACK: ActionInfo = { label: 'Outro', icon: 'mdi-information-outline', color: 'secondary', sentence: 'realizou {target}' }

export const auditActionInfo = (action: string): ActionInfo => AUDIT_ACTIONS[action] ?? FALLBACK

/** Opções do filtro por tipo de ação. */
export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTIONS).map(([value, info]) => ({
  value,
  title: info.label,
}))

export interface SentencePart {
  text: string
  bold: boolean
}

/**
 * Frase do evento em partes (para pôr os nomes em negrito sem v-html):
 * "Bruna" + " desativou o usuário " + "Rafa".
 */
export function auditSentence(entry: AuditLogEntry): SentencePart[] {
  const info = auditActionInfo(entry.action)
  const target = entry.target?.label ?? (entry.target?.type === 'User' ? 'um usuário' : '')
  const [before = '', after = ''] = info.sentence.split('{target}')

  const parts: SentencePart[] = [
    { text: entry.actor.label, bold: true },
    { text: ` ${before}`, bold: false },
  ]
  if (info.sentence.includes('{target}')) {
    parts.push({ text: target, bold: true })
    if (after) parts.push({ text: after, bold: false })
  }

  const extra = auditDetail(entry)
  if (extra) parts.push({ text: ` (${extra})`, bold: false })
  return parts
}

/** Complemento a partir do metadata, quando houver. */
function auditDetail(entry: AuditLogEntry): string | null {
  const { roles, scheduledFor, fields, primaryColor } = entry.metadata
  if (entry.action === 'clinic.schedule_settings_updated') return scheduleSettingsDetail(entry.metadata)
  if (entry.action === 'appointment.status_changed') return appointmentStatusDetail(entry.metadata)
  if (entry.action === 'clinic.branding_updated' && primaryColor && typeof primaryColor === 'object') {
    const { from, to } = primaryColor as { from?: string | null, to?: string | null }
    return `de ${from ?? 'padrão'} para ${to ?? 'padrão'}`
  }
  if (entry.action === 'user.created' && Array.isArray(roles)) {
    return `como ${rolesLabel(roles as UserRole[]).toLowerCase()}`
  }
  if (entry.action === 'user.roles_changed' && roles && typeof roles === 'object') {
    const { from, to } = roles as { from?: UserRole[], to?: UserRole[] }
    if (from && to) return `de ${rolesLabel(from).toLowerCase()} para ${rolesLabel(to).toLowerCase()}`
  }
  if (entry.action === 'patient.updated' && Array.isArray(fields)) {
    return `campos: ${fields.map(field => PATIENT_FIELD_LABELS[field as string] ?? field).join(', ')}`
  }
  if (entry.action === 'clinic.deletion_confirmed' && typeof scheduledFor === 'string') {
    return `exclusão definitiva em ${new Date(scheduledFor).toLocaleDateString('pt-BR')}`
  }
  return null
}

interface Change<T> { from?: T, to?: T }

function scheduleSettingsDetail(metadata: AuditLogEntry['metadata']): string | null {
  const timeZone = metadata.timeZone as Change<string> | undefined
  const minutes = metadata.defaultAppointmentMinutes as Change<number> | undefined
  const parts: string[] = []
  if (timeZone?.to) parts.push(`fuso: ${timeZoneLabel(timeZone.to)}`)
  if (minutes?.to) parts.push(`duração padrão: ${minutes.from} → ${minutes.to} min`)
  return parts.length ? parts.join('; ') : null
}

function appointmentStatusDetail(metadata: AuditLogEntry['metadata']): string | null {
  const status = metadata.status as Change<AppointmentStatus> | undefined
  if (!status?.from || !status.to) return null
  return `de ${APPOINTMENT_STATUS[status.from].label.toLowerCase()} para ${APPOINTMENT_STATUS[status.to].label.toLowerCase()}`
}

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
