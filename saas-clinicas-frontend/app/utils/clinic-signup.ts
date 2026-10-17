import type { BusinessHourForm, ClinicSignupForm, CreateClinicPayload } from '~/types/clinic'

/** Ordem de exibição: semana começando na segunda. */
export const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
] as const

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find(day => day.value === weekday)?.label ?? ''
}

/** Seg–sex abertos das 08:00 às 18:00; sábado sugerido até 12:00. */
export function createEmptySignupForm(): ClinicSignupForm {
  return {
    clinic: { name: '', email: '', phone: '', document: '' },
    businessHours: WEEKDAYS.map<BusinessHourForm>(({ value }) => ({
      weekday: value,
      open: value >= 1 && value <= 5,
      opensAt: '08:00',
      closesAt: value === 6 ? '12:00' : '18:00',
    })),
    admin: { name: '', email: '', password: '', passwordConfirmation: '' },
  }
}

export function toCreateClinicPayload(form: ClinicSignupForm): CreateClinicPayload {
  const document = onlyDigits(form.clinic.document)

  return {
    clinic: {
      name: form.clinic.name.trim(),
      email: form.clinic.email.trim(),
      phone: onlyDigits(form.clinic.phone),
      ...(document ? { document } : {}),
    },
    businessHours: form.businessHours
      .filter(hour => hour.open)
      .map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt })),
    admin: {
      name: form.admin.name.trim(),
      email: form.admin.email.trim(),
      password: form.admin.password,
    },
  }
}
