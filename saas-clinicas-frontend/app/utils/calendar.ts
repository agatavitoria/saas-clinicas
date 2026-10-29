/** Datas de calendário no formato YYYY-MM-DD, sem fuso (aritmética em UTC). */

const parse = (date: string) => new Date(`${date}T00:00:00Z`)
const format = (date: Date) => date.toISOString().slice(0, 10)

export function addDays(date: string, days: number): string {
  const value = parse(date)
  value.setUTCDate(value.getUTCDate() + days)
  return format(value)
}

/** 0 = domingo ... 6 = sábado */
export const weekdayOf = (date: string) => parse(date).getUTCDay()

/** Segunda-feira da semana da data. */
export const startOfWeek = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7))

export const weekDates = (date: string) =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index))

/** "seg., 3 de nov." */
export const formatShortDate = (date: string) =>
  parse(date).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

/** "segunda-feira, 3 de novembro de 2026" */
export const formatLongDate = (date: string) =>
  parse(date).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** "3 – 9 de nov. de 2026" */
export function formatWeekRange(date: string): string {
  const [first, last] = [startOfWeek(date), addDays(startOfWeek(date), 6)]
  const end = parse(last).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  const start = parse(first).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: 'numeric',
    ...(first.slice(5, 7) === last.slice(5, 7) ? {} : { month: 'short' }),
  })
  return `${start} – ${end}`
}

/** "HH:mm" → minutos desde a meia-noite. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number]
  return hours * 60 + minutes
}

export const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
