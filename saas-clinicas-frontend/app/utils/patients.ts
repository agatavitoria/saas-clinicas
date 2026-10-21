import type { Gender, PatientDetails, PatientPayload, PatientSummary } from '~/types/patient'

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Feminino',
  MALE: 'Masculino',
  NON_BINARY: 'Não binário',
  OTHER: 'Outro',
  UNDISCLOSED: 'Prefere não informar',
}

export const GENDER_OPTIONS = (Object.keys(GENDER_LABELS) as Gender[]).map(value => ({
  value,
  title: GENDER_LABELS[value],
}))

/** Nomes dos campos (para o histórico de "editou o cadastro"). */
export const PATIENT_FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  socialName: 'nome social',
  cpf: 'CPF',
  birthDate: 'data de nascimento',
  gender: 'gênero',
  phone: 'telefone',
  email: 'e-mail',
  emergencyContactName: 'contato de emergência',
  emergencyContactPhone: 'telefone de emergência',
}

/** Nome social tem prioridade no atendimento. */
export const displayName = (patient: Pick<PatientSummary, 'name' | 'socialName'>) =>
  patient.socialName || patient.name

/** "1990-05-20T00:00:00.000Z" → "1990-05-20" (a data vem à meia-noite UTC). */
export const dateOnly = (iso: string) => iso.slice(0, 10)

export const formatBirthDate = (iso: string) => {
  const [year, month, day] = dateOnly(iso).split('-')
  return `${day}/${month}/${year}`
}

export function ageFrom(iso: string, today = new Date()): number {
  const [year, month, day] = dateOnly(iso).split('-').map(Number) as [number, number, number]
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--
  return age
}

export const ageLabel = (iso: string) => {
  const age = ageFrom(iso)
  return age === 1 ? '1 ano' : `${age} anos`
}

export function emptyPatientPayload(): PatientPayload {
  return {
    name: '',
    cpf: '',
    birthDate: '',
    socialName: null,
    gender: null,
    phone: null,
    email: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
  }
}

/** Ficha → valores do formulário (com máscaras). */
export function toPatientForm(patient: PatientDetails): PatientPayload {
  return {
    name: patient.name,
    cpf: formatCpf(patient.cpf),
    birthDate: dateOnly(patient.birthDate),
    socialName: patient.socialName,
    gender: patient.gender,
    phone: patient.phone ? formatPhone(patient.phone) : null,
    email: patient.email,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone ? formatPhone(patient.emergencyContactPhone) : null,
  }
}

/** Valores do formulário → corpo da API (texto vazio vira null). */
export function toPatientPayload(form: PatientPayload): PatientPayload {
  const optional = (value: string | null) => (value?.trim() ? value.trim() : null)
  return {
    name: form.name.trim(),
    cpf: onlyDigits(form.cpf),
    birthDate: form.birthDate,
    socialName: optional(form.socialName),
    gender: form.gender,
    phone: form.phone ? optional(onlyDigits(form.phone)) : null,
    email: optional(form.email),
    emergencyContactName: optional(form.emergencyContactName),
    emergencyContactPhone: form.emergencyContactPhone ? optional(onlyDigits(form.emergencyContactPhone)) : null,
  }
}
