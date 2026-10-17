import type { BusinessHour } from '~/types/clinic'

export interface OpeningStatus {
  open: boolean
  /** Ex.: "Aberta agora · fecha às 18:00" */
  label: string
}

const toTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

/**
 * Situação da clínica no momento informado. Usa o fuso de quem está vendo,
 * já que a clínica ainda não tem fuso cadastrado.
 */
export function openingStatus(hours: BusinessHour[], now = new Date()): OpeningStatus {
  const today = hours.find(hour => hour.weekday === now.getDay())
  const time = toTime(now)

  if (today && time >= today.opensAt && time < today.closesAt) {
    return { open: true, label: `Aberta agora · fecha às ${today.closesAt}` }
  }
  if (today && time < today.opensAt) {
    return { open: false, label: `Fechada · abre hoje às ${today.opensAt}` }
  }

  const next = nextOpening(hours, now.getDay())
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
