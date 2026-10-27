import type { BusinessHourForm, ClinicForm, CreateClinicPayload } from '~/types/clinic'

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
export function createEmptyClinicForm(): ClinicForm {
  return {
    clinic: { name: '', slug: '', email: '', phone: '', document: '' },
    businessHours: WEEKDAYS.map<BusinessHourForm>(({ value }) => ({
      weekday: value,
      open: value >= 1 && value <= 5,
      opensAt: '08:00',
      closesAt: value === 6 ? '12:00' : '18:00',
    })),
    admin: { name: '', email: '', temporaryPassword: generateTemporaryPassword() },
  }
}

export function toCreateClinicPayload(form: ClinicForm): CreateClinicPayload {
  const document = onlyDigits(form.clinic.document)

  return {
    clinic: {
      name: form.clinic.name.trim(),
      slug: form.clinic.slug.trim(),
      email: form.clinic.email.trim(),
      phone: onlyDigits(form.clinic.phone),
      ...(document ? { document } : {}),
    },
    businessHours: fromHoursForm(form.businessHours),
    admin: {
      name: form.admin.name.trim(),
      email: form.admin.email.trim(),
      temporaryPassword: form.admin.temporaryPassword,
    },
  }
}
