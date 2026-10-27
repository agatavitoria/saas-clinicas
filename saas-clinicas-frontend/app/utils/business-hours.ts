import type { BusinessHour, BusinessHourForm } from '~/types/clinic'

export interface OpeningStatus {
  open: boolean
  /** Ex.: "Aberta agora · fecha às 18:00" */
  label: string
}

/** Situação da clínica no momento informado, no fuso da clínica. */
export function openingStatus(hours: BusinessHour[], timeZone: string, now = new Date()): OpeningStatus {
  const { weekday, time } = zonedClock(now, timeZone)
  const today = hours.find(hour => hour.weekday === weekday)

  if (today && time >= today.opensAt && time < today.closesAt) {
    return { open: true, label: `Aberta agora · fecha às ${today.closesAt}` }
  }
  if (today && time < today.opensAt) {
    return { open: false, label: `Fechada · abre hoje às ${today.opensAt}` }
  }

  const next = nextOpening(hours, weekday)
  return {
    open: false,
    label: next ? `Fechada · abre ${next.when} às ${next.opensAt}` : 'Fechada',
  }
}

function nextOpening(hours: BusinessHour[], weekday: number) {
  for (let offset = 1; offset <= 7; offset++) {
    const day = (weekday + offset) % 7
    const hour = hours.find(item => item.weekday === day)
    if (hour) {
      const when = offset === 1 ? 'amanhã' : weekdayLabel(day).toLowerCase()
      return { when, opensAt: hour.opensAt }
    }
  }
  return null
}

/** Semana completa para edição; os dias fechados sugerem 08:00–18:00. */
export function toHoursForm(hours: BusinessHour[]): BusinessHourForm[] {
  return WEEKDAYS.map(({ value }) => {
    const hour = hours.find(item => item.weekday === value)
    return {
      weekday: value,
      open: Boolean(hour),
      opensAt: hour?.opensAt ?? '08:00',
      closesAt: hour?.closesAt ?? '18:00',
    }
  })
}

/** Só os dias abertos, no formato da API. */
export function fromHoursForm(hours: BusinessHourForm[]): BusinessHour[] {
  return hours
    .filter(hour => hour.open)
    .map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt }))
}
