<script setup lang="ts">
import type { Appointment } from '~/types/appointment'

export interface AgendaColumn {
  key: string
  title: string
  subtitle?: string
  /** Destaque do cabeçalho (ex.: hoje) */
  highlight?: boolean
  /** Funcionamento em minutos desde a meia-noite; null = fechado */
  openRange: [number, number] | null
  /** Minuto atual, quando a coluna é de hoje (linha do "agora") */
  nowMinute?: number
  events: Appointment[]
}

const props = withDefaults(
  defineProps<{
    columns: AgendaColumn[]
    /** Primeiro e último minuto exibidos (múltiplos de 60) */
    startMinute: number
    endMinute: number
    timeZone: string
    /** Exibe o profissional no cartão (quando a coluna não é dele) */
    showProfessional?: boolean
    canCreate?: boolean
  }>(),
  { showProfessional: false, canCreate: false },
)

const emit = defineEmits<{
  'select-slot': [columnKey: string, minute: number]
  'select-event': [appointment: Appointment]
}>()

const PX_PER_MINUTE = 1.2
/** Abaixo desta altura, horário e paciente dividem uma linha só */
const COMPACT_HEIGHT = 44
const SNAP_MINUTES = 15
const HOUR_HEIGHT = 60 * PX_PER_MINUTE

const gridHeight = computed(() => (props.endMinute - props.startMinute) * PX_PER_MINUTE)
const hours = computed(() =>
  Array.from({ length: (props.endMinute - props.startMinute) / 60 }, (_, index) =>
    minutesToTime(props.startMinute + index * 60)),
)

const top = (minute: number) => (minute - props.startMinute) * PX_PER_MINUTE

interface PositionedEvent {
  appointment: Appointment
  top: number
  height: number
  left: string
  width: string
  time: string
}

/**
 * Agendamentos sobrepostos (ex.: profissionais diferentes no mesmo dia)
 * dividem a largura da coluna em faixas.
 */
function layout(events: Appointment[]): PositionedEvent[] {
  const items = events
    .map((appointment) => {
      const start = zonedMinutes(new Date(appointment.startsAt), props.timeZone)
      return { appointment, start, end: start + durationMinutes(appointment), lane: 0 }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const positioned: PositionedEvent[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    const lanes = Math.max(...cluster.map(item => item.lane)) + 1
    for (const item of cluster) {
      positioned.push({
        appointment: item.appointment,
        top: top(item.start),
        height: Math.max((item.end - item.start) * PX_PER_MINUTE, 22),
        left: `${(item.lane / lanes) * 100}%`,
        width: `${100 / lanes}%`,
        time: appointmentTimeRange(item.appointment, props.timeZone),
      })
    }
    cluster = []
  }

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush()
    const laneEnds = new Map<number, number>()
    for (const other of cluster) laneEnds.set(other.lane, Math.max(laneEnds.get(other.lane) ?? 0, other.end))
    let lane = 0
    while ((laneEnds.get(lane) ?? -1) > item.start) lane++
    item.lane = lane
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  if (cluster.length) flush()
  return positioned
}

const positioned = computed(() => props.columns.map(column => layout(column.events)))

/** Faixas fechadas (antes da abertura e depois do fechamento). */
function closedBands(column: AgendaColumn) {
  if (!column.openRange) return [{ top: 0, height: gridHeight.value }]
  const [opens, closes] = column.openRange
  return [
    { top: 0, height: Math.max(top(opens), 0) },
    { top: top(closes), height: Math.max(gridHeight.value - top(closes), 0) },
  ].filter(band => band.height > 0)
}

function onColumnClick(column: AgendaColumn, event: MouseEvent) {
  if (!props.canCreate) return
  // Relativo à coluna, mesmo quando o clique cai numa faixa fechada
  const columnTop = (event.currentTarget as HTMLElement).closest('.agenda__column')!.getBoundingClientRect().top
  const offset = (event.clientY - columnTop) / PX_PER_MINUTE
  const minute = props.startMinute + Math.floor(offset / SNAP_MINUTES) * SNAP_MINUTES
  emit('select-slot', column.key, minute)
}

const eventLabel = (appointment: Appointment) => {
  const status = APPOINTMENT_STATUS[appointment.status].label
  return `${displayName(appointment.patient)}, ${appointmentTimeRange(appointment, props.timeZone)}, ${status}`
}
</script>

<template>
  <div class="agenda-scroll">
    <div class="agenda" :style="{ '--columns': columns.length }">
      <!-- Cabeçalho -->
      <div class="agenda__corner" />
      <div
        v-for="column in columns"
        :key="`head-${column.key}`"
        class="agenda__head"
        :class="{ 'agenda__head--highlight': column.highlight }"
      >
        <div class="text-body-2 font-weight-medium text-truncate">{{ column.title }}</div>
        <div v-if="column.subtitle" class="text-caption text-medium-emphasis text-truncate">{{ column.subtitle }}</div>
      </div>

      <!-- Horas -->
      <div class="agenda__gutter" :style="{ height: `${gridHeight}px` }">
        <div v-for="hour in hours" :key="hour" class="agenda__hour" :style="{ height: `${HOUR_HEIGHT}px` }">
          <span class="text-caption text-medium-emphasis">{{ hour }}</span>
        </div>
      </div>

      <!-- Colunas -->
      <div
        v-for="(column, index) in columns"
        :key="`col-${column.key}`"
        class="agenda__column"
        :class="{ 'agenda__column--clickable': canCreate }"
        :style="{ 'height': `${gridHeight}px`, '--hour-height': `${HOUR_HEIGHT}px` }"
        @click.self="onColumnClick(column, $event)"
      >
        <div
          v-for="(band, bandIndex) in closedBands(column)"
          :key="bandIndex"
          class="agenda__closed"
          :style="{ top: `${band.top}px`, height: `${band.height}px` }"
          @click="onColumnClick(column, $event)"
        />

        <div
          v-if="column.nowMinute !== undefined && column.nowMinute >= startMinute && column.nowMinute <= endMinute"
          class="agenda__now"
          :style="{ top: `${top(column.nowMinute)}px` }"
        />

        <button
          v-for="item in positioned[index]"
          :key="item.appointment.id"
          type="button"
          class="agenda__event"
          :class="[
            `agenda__event--${item.appointment.status.toLowerCase()}`,
            `bg-${APPOINTMENT_STATUS[item.appointment.status].color}`,
            { 'agenda__event--compact': item.height < COMPACT_HEIGHT },
          ]"
          :style="{ top: `${item.top}px`, height: `${item.height}px`, left: item.left, width: item.width }"
          :aria-label="eventLabel(item.appointment)"
          @click.stop="emit('select-event', item.appointment)"
        >
          <div class="d-flex align-center ga-1 text-caption agenda__event-time">
            <span class="font-weight-medium">{{ item.time }}</span>
            <v-icon v-if="item.appointment.outsideBusinessHours" icon="mdi-clock-alert-outline" size="12" />
          </div>
          <div class="text-caption font-weight-bold text-truncate">{{ displayName(item.appointment.patient) }}</div>
          <div v-if="showProfessional && item.height >= COMPACT_HEIGHT" class="text-caption text-truncate agenda__event-sub">
            {{ item.appointment.professional.name }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agenda-scroll {
  overflow-x: auto;
}

.agenda {
  display: grid;
  grid-template-columns: 56px repeat(var(--columns), minmax(120px, 1fr));
  min-width: fit-content;
}

.agenda__corner,
.agenda__head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 8px;
}

.agenda__head--highlight {
  color: rgb(var(--v-theme-primary));
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}

.agenda__gutter {
  position: relative;
}

.agenda__hour {
  position: relative;
  text-align: right;
  padding-right: 8px;
}

.agenda__hour span {
  position: relative;
  top: -0.6em;
}

/* A primeira hora fica logo abaixo do cabeçalho fixo */
.agenda__hour:first-child span {
  top: 2px;
}

.agenda__column {
  position: relative;
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(var(--v-border-color), var(--v-border-opacity)) 0 1px,
    transparent 1px var(--hour-height)
  );
}

.agenda__column--clickable {
  cursor: pointer;
}

.agenda__closed {
  position: absolute;
  inset-inline: 0;
  background: repeating-linear-gradient(
    135deg,
    rgba(var(--v-theme-on-surface), 0.04) 0 6px,
    rgba(var(--v-theme-on-surface), 0.08) 6px 12px
  );
}

.agenda__now {
  position: absolute;
  inset-inline: 0;
  z-index: 1;
  border-top: 2px solid rgb(var(--v-theme-error));
  pointer-events: none;
}

.agenda__event {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  padding: 2px 6px;
  border: 1px solid rgb(var(--v-theme-surface));
  border-radius: 6px;
  text-align: left;
  line-height: 1.25;
  cursor: pointer;
}

.agenda__event:focus-visible {
  outline: 2px solid rgb(var(--v-theme-on-surface));
  outline-offset: 1px;
}

.agenda__event--cancelled,
.agenda__event--no_show {
  opacity: 0.6;
  text-decoration: line-through;
}

.agenda__event--compact {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.agenda__event--compact .agenda__event-time {
  flex-shrink: 0;
}

.agenda__event-sub {
  opacity: 0.85;
}
</style>
