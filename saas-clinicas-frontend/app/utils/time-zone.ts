export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'

/** Fusos do Brasil, com o nome que a equipe reconhece. */
const BRAZIL_TIME_ZONES: Record<string, string> = {
  'America/Sao_Paulo': 'Brasília (SP, RJ, MG, Sul, GO, DF, BA, NE)',
  'America/Manaus': 'Amazonas (Manaus)',
  'America/Cuiaba': 'Mato Grosso (Cuiabá)',
  'America/Campo_Grande': 'Mato Grosso do Sul (Campo Grande)',
  'America/Porto_Velho': 'Rondônia (Porto Velho)',
  'America/Boa_Vista': 'Roraima (Boa Vista)',
  'America/Rio_Branco': 'Acre (Rio Branco)',
  'America/Noronha': 'Fernando de Noronha',
}

export interface TimeZoneOption {
  value: string
  title: string
}

/** Fusos do Brasil primeiro; os demais vêm do runtime, pelo nome IANA. */
export function timeZoneOptions(): TimeZoneOption[] {
  const brazil = Object.entries(BRAZIL_TIME_ZONES).map(([value, label]) => ({
    value,
    title: `${label} · ${value}`,
  }))
  const others = Intl.supportedValuesOf('timeZone')
    .filter(zone => !(zone in BRAZIL_TIME_ZONES))
    .map(zone => ({ value: zone, title: zone }))
  return [...brazil, ...others]
}

export const timeZoneLabel = (timeZone: string): string =>
  BRAZIL_TIME_ZONES[timeZone] ?? timeZone

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Dia da semana (0 = domingo) e horário HH:mm de um instante no fuso informado. */
export function zonedClock(date: Date, timeZone: string): { weekday: number, time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(part => [part.type, part.value]),
  )
  return { weekday: WEEKDAY_INDEX[parts.weekday!]!, time: `${parts.hour}:${parts.minute}` }
}
