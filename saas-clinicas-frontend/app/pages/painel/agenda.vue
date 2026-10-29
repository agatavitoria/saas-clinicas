<script setup lang="ts">
import type { AgendaColumn } from '~/components/agenda/AgendaGrid.vue'
import type { Appointment, Professional } from '~/types/appointment'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Agenda · SaaS Clínicas' })

const api = useApi()
const { user, hasRole } = useAuth()
const { clinic, ensureLoaded, readOnly } = useClinic()

const ALL = 'all'
const VIEWS = [
  { value: 'day', title: 'Dia', icon: 'mdi-calendar-today-outline' },
  { value: 'week', title: 'Semana', icon: 'mdi-calendar-week-outline' },
] as const

const timeZone = computed(() => clinic.value?.timeZone ?? DEFAULT_TIME_ZONE)
const now = useNow()
const today = computed(() => zonedDate(now.value, timeZone.value))

const view = ref<'day' | 'week'>('day')
const date = ref('')
const professionalId = ref<string>(ALL)
const showCancelled = ref(false)

/** Recepção e admin gerenciam qualquer agenda; o profissional, só a própria. */
const managesAll = computed(() => hasRole('RECEPTION', 'ADMIN'))
const isProfessional = computed(() => hasRole('PROFESSIONAL'))
const canCreate = computed(() => !readOnly.value && (managesAll.value || isProfessional.value))
const canManage = (appointment: Appointment) =>
  managesAll.value || appointment.professional.id === user.value?.id

const professionals = ref<Professional[]>([])
const appointments = ref<Appointment[]>([])
const status = ref<'pending' | 'success' | 'error'>('pending')
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const [, list] = await Promise.all([ensureLoaded(), api<Professional[]>('/professionals')])
    professionals.value = list
    date.value = today.value
    // Só quem é apenas profissional começa na própria agenda; admin e recepção veem todos
    if (!managesAll.value && user.value && list.some(professional => professional.id === user.value!.id)) {
      professionalId.value = user.value.id
    }
    status.value = 'success'
  }
  catch (err) {
    error.value = errorMessage(err)
    status.value = 'error'
  }
})

const visibleDates = computed(() => (view.value === 'day' ? [date.value] : weekDates(date.value)))

async function load() {
  if (!date.value || status.value !== 'success') return
  const dates = visibleDates.value
  loading.value = true
  error.value = ''
  try {
    appointments.value = await api<Appointment[]>('/appointments', {
      query: {
        from: zonedToInstant(dates[0]!, '00:00', timeZone.value).toISOString(),
        to: zonedToInstant(addDays(dates[dates.length - 1]!, 1), '00:00', timeZone.value).toISOString(),
        professionalId: professionalId.value === ALL ? undefined : professionalId.value,
      },
    })
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

watch([visibleDates, professionalId, status], load)

function move(direction: -1 | 1) {
  date.value = addDays(date.value, direction * (view.value === 'day' ? 1 : 7))
}

const periodLabel = computed(() => {
  if (!date.value) return ''
  return view.value === 'day' ? formatLongDate(date.value) : formatWeekRange(date.value)
})

// Grade
const visibleAppointments = computed(() =>
  appointments.value.filter(appointment => showCancelled.value || !isInactiveAppointment(appointment)),
)

const appointmentDate = (appointment: Appointment) => zonedDate(new Date(appointment.startsAt), timeZone.value)

function openRange(day: string): [number, number] | null {
  const hours = clinic.value?.businessHours.find(hour => hour.weekday === weekdayOf(day))
  return hours ? [timeToMinutes(hours.opensAt), timeToMinutes(hours.closesAt)] : null
}

const nowMinute = (day: string) => (day === today.value ? zonedMinutes(now.value, timeZone.value) : undefined)

/** Dia: uma coluna por profissional. Semana: uma coluna por dia. */
const columns = computed<AgendaColumn[]>(() => {
  if (view.value === 'week') {
    return visibleDates.value.map(day => ({
      key: day,
      title: formatShortDate(day),
      highlight: day === today.value,
      openRange: openRange(day),
      nowMinute: nowMinute(day),
      events: visibleAppointments.value.filter(appointment => appointmentDate(appointment) === day),
    }))
  }

  const day = date.value
  const shown = professionalId.value === ALL
    ? professionals.value
    : professionals.value.filter(professional => professional.id === professionalId.value)
  // Agendamentos de quem deixou de ser profissional continuam visíveis
  const extra = visibleAppointments.value
    .map(appointment => appointment.professional)
    .filter((professional, index, all) =>
      !shown.some(item => item.id === professional.id)
      && all.findIndex(item => item.id === professional.id) === index
      && (professionalId.value === ALL || professional.id === professionalId.value))
  return [...shown, ...extra].map(professional => ({
    key: professional.id,
    title: professional.name,
    openRange: openRange(day),
    nowMinute: nowMinute(day),
    events: visibleAppointments.value.filter(appointment => appointment.professional.id === professional.id),
  }))
})

/** Do primeiro horário de abertura ao último de fechamento, incluindo os encaixes. */
const bounds = computed(() => {
  const opens = clinic.value?.businessHours.map(hour => timeToMinutes(hour.opensAt)) ?? []
  const closes = clinic.value?.businessHours.map(hour => timeToMinutes(hour.closesAt)) ?? []
  const starts = visibleAppointments.value.map(appointment => zonedMinutes(new Date(appointment.startsAt), timeZone.value))
  const ends = visibleAppointments.value.map((appointment) => {
    const start = zonedMinutes(new Date(appointment.startsAt), timeZone.value)
    return Math.min(start + durationMinutes(appointment), 24 * 60)
  })
  const start = Math.min(8 * 60, ...opens, ...starts)
  const end = Math.max(18 * 60, ...closes, ...ends)
  return { start: Math.floor(start / 60) * 60, end: Math.min(Math.ceil(end / 60) * 60, 24 * 60) }
})

const professionalOptions = computed(() => [
  { value: ALL, title: 'Todos os profissionais' },
  ...professionals.value.map(professional => ({ value: professional.id, title: professional.name })),
])

// Diálogos
const snackbar = reactive({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => Object.assign(snackbar, { show: true, text, color })

const formOpen = ref(false)
const editing = ref<Appointment | null>(null)
const initial = ref<{ date: string, time: string, professionalId?: string }>()
const lockedProfessionalId = computed(() => (managesAll.value ? null : user.value?.id ?? null))

function openNew(slot?: { date: string, time: string, professionalId?: string }) {
  editing.value = null
  initial.value = slot ?? {
    date: date.value,
    time: '09:00',
    professionalId: professionalId.value === ALL ? undefined : professionalId.value,
  }
  formOpen.value = true
}

function onSelectSlot(columnKey: string, minute: number) {
  const time = minutesToTime(minute)
  if (view.value === 'week') {
    openNew({ date: columnKey, time, professionalId: professionalId.value === ALL ? undefined : professionalId.value })
  }
  else {
    openNew({ date: date.value, time, professionalId: columnKey })
  }
}

const detailsOpen = ref(false)
const selected = ref<Appointment | null>(null)

function onSelectEvent(appointment: Appointment) {
  selected.value = appointment
  detailsOpen.value = true
}

function replace(appointment: Appointment) {
  const index = appointments.value.findIndex(item => item.id === appointment.id)
  if (index >= 0) appointments.value.splice(index, 1, appointment)
  else appointments.value.push(appointment)
}

function onUpdated(appointment: Appointment) {
  replace(appointment)
  selected.value = appointment
  notify(`Agendamento marcado como ${APPOINTMENT_STATUS[appointment.status].label.toLowerCase()}.`)
}

function onReschedule(appointment: Appointment) {
  detailsOpen.value = false
  editing.value = appointment
  formOpen.value = true
}

async function onSaved(appointment: Appointment) {
  notify(editing.value ? 'Agendamento atualizado.' : 'Agendamento criado.')
  // O agendamento pode ter ido para outro período: recarrega o que está na tela
  await load()
  date.value = appointmentDate(appointment)
}
</script>

<template>
  <v-container class="py-6" fluid style="max-width: 1400px">
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold">Agenda</h1>
        <p class="text-body-1 text-medium-emphasis text-capitalize-first">{{ periodLabel }}</p>
      </div>
      <v-btn v-if="canCreate" color="primary" prepend-icon="mdi-calendar-plus" :disabled="status !== 'success'" @click="openNew()">
        Novo agendamento
      </v-btn>
    </div>

    <v-alert v-if="status === 'error'" type="error" variant="tonal" :text="error || 'Não foi possível carregar a agenda.'" />

    <v-skeleton-loader v-else-if="status === 'pending'" type="table" class="rounded-xl" />

    <v-card v-else elevation="1">
      <v-toolbar color="surface" density="comfortable" class="px-2 flex-wrap agenda-toolbar">
        <div class="d-flex align-center ga-1">
          <v-btn icon="mdi-chevron-left" variant="text" :aria-label="view === 'day' ? 'Dia anterior' : 'Semana anterior'" @click="move(-1)" />
          <v-btn variant="tonal" size="small" :disabled="date === today" @click="date = today">Hoje</v-btn>
          <v-btn icon="mdi-chevron-right" variant="text" :aria-label="view === 'day' ? 'Próximo dia' : 'Próxima semana'" @click="move(1)" />
          <v-text-field
            v-model="date"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            aria-label="Ir para a data"
            style="max-width: 170px"
          />
        </div>

        <v-spacer />

        <div class="d-flex flex-wrap align-center ga-3">
          <v-select
            v-model="professionalId"
            :items="professionalOptions"
            density="compact"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-stethoscope"
            aria-label="Profissional"
            style="min-width: 240px"
          />
          <v-checkbox v-model="showCancelled" label="Cancelados e faltas" density="compact" hide-details />
          <v-btn-toggle v-model="view" mandatory density="compact" variant="outlined" divided>
            <v-btn v-for="option in VIEWS" :key="option.value" :value="option.value" :prepend-icon="option.icon">
              {{ option.title }}
            </v-btn>
          </v-btn-toggle>
        </div>
      </v-toolbar>

      <v-progress-linear :active="loading" indeterminate color="primary" />
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="ma-4" :text="error" />

      <v-card-text v-if="columns.length === 0" class="text-center py-12">
        <v-icon icon="mdi-stethoscope" size="48" class="mb-2 text-medium-emphasis" />
        <p class="text-body-1">Nenhum profissional ativo na clínica.</p>
        <p class="text-body-2 text-medium-emphasis">
          Em Equipe, dê o papel de profissional a quem atende para montar a agenda.
        </p>
      </v-card-text>

      <AgendaGrid
        v-else
        :columns="columns"
        :start-minute="bounds.start"
        :end-minute="bounds.end"
        :time-zone="timeZone"
        :show-professional="view === 'week' && professionalId === ALL"
        :can-create="canCreate"
        @select-slot="onSelectSlot"
        @select-event="onSelectEvent"
      />

      <v-divider />
      <v-card-text class="d-flex flex-wrap ga-3 text-caption text-medium-emphasis">
        <span v-for="(info, key) in APPOINTMENT_STATUS" :key="key" class="d-flex align-center ga-1">
          <v-icon :icon="info.icon" :color="info.color" size="16" /> {{ info.label }}
        </span>
        <span class="d-flex align-center ga-1">
          <v-icon icon="mdi-clock-alert-outline" size="16" /> Encaixe fora do horário
        </span>
        <v-spacer />
        <span>Horários no fuso {{ timeZoneLabel(timeZone) }}</span>
      </v-card-text>
    </v-card>

    <AgendaAppointmentFormDialog
      v-if="clinic"
      v-model="formOpen"
      :professionals="professionals"
      :time-zone="timeZone"
      :default-minutes="clinic.defaultAppointmentMinutes"
      :appointment="editing"
      :initial="initial"
      :locked-professional-id="lockedProfessionalId"
      @saved="onSaved"
    />

    <AgendaAppointmentDetailsDialog
      v-model="detailsOpen"
      :appointment="selected"
      :time-zone="timeZone"
      :can-manage="selected ? canManage(selected) : false"
      :read-only="readOnly"
      @updated="onUpdated"
      @reschedule="onReschedule"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.text-capitalize-first::first-letter {
  text-transform: uppercase;
}

.agenda-toolbar :deep(.v-toolbar__content) {
  flex-wrap: wrap;
  height: auto !important;
  gap: 8px;
  padding-block: 8px;
}
</style>
