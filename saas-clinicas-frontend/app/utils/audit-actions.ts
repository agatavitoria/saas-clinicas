import type { AuditLogEntry } from '~/types/audit'

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
  'user.password_reset': { label: 'Senha redefinida', icon: 'mdi-key-change', color: 'warning', sentence: 'redefiniu a senha de {target}' },
  'clinic.created': { label: 'Clínica criada', icon: 'mdi-domain-plus', color: 'success', sentence: 'criou a clínica {target}' },
  'clinic.deactivated': { label: 'Clínica desativada', icon: 'mdi-domain-off', color: 'error', sentence: 'desativou a clínica {target}' },
  'clinic.reactivated': { label: 'Clínica reativada', icon: 'mdi-domain', color: 'success', sentence: 'reativou a clínica {target}' },
  'patient.created': { label: 'Paciente cadastrado', icon: 'mdi-account-heart-outline', color: 'success', sentence: 'cadastrou o paciente {target}' },
  'patient.updated': { label: 'Paciente editado', icon: 'mdi-account-edit-outline', color: 'primary', sentence: 'editou o cadastro de {target}' },
  'patient.viewed': { label: 'Ficha consultada', icon: 'mdi-eye-outline', color: 'secondary', sentence: 'abriu a ficha de {target}' },
  'patient.deactivated': { label: 'Paciente inativado', icon: 'mdi-account-off-outline', color: 'error', sentence: 'inativou o paciente {target}' },
  'patient.reactivated': { label: 'Paciente reativado', icon: 'mdi-account-check-outline', color: 'success', sentence: 'reativou o paciente {target}' },
  'patient_record.created': { label: 'Atendimento registrado', icon: 'mdi-clipboard-text-outline', color: 'primary', sentence: 'registrou um atendimento de {target}' },
  'patient_record.amended': { label: 'Adendo no prontuário', icon: 'mdi-clipboard-edit-outline', color: 'warning', sentence: 'adicionou um adendo ao prontuário de {target}' },
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
  const { role, scheduledFor, fields } = entry.metadata
  if (entry.action === 'user.created' && typeof role === 'string' && role in ROLE_LABELS) {
    return `como ${ROLE_LABELS[role as keyof typeof ROLE_LABELS].toLowerCase()}`
  }
  if (entry.action === 'patient.updated' && Array.isArray(fields)) {
    return `campos: ${fields.map(field => PATIENT_FIELD_LABELS[field as string] ?? field).join(', ')}`
  }
  if (entry.action === 'clinic.deletion_confirmed' && typeof scheduledFor === 'string') {
    return `exclusão definitiva em ${new Date(scheduledFor).toLocaleDateString('pt-BR')}`
  }
  return null
}

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
