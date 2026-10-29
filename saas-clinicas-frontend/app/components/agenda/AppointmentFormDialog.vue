<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { Appointment, AppointmentPayload, Professional } from '~/types/appointment'
import type { PatientPage, PatientSummary } from '~/types/patient'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  professionals: Professional[]
  timeZone: string
  defaultMinutes: number
  /** Preenchido: remarcação deste agendamento. Vazio: novo agendamento. */
  appointment?: Appointment | null
  /** Sugestão para um agendamento novo (ex.: horário clicado na grade). */
  initial?: { date: string, time: string, professionalId?: string }
  /** Profissional que só pode marcar na própria agenda. */
  lockedProfessionalId?: string | null
}>()

const emit = defineEmits<{ saved: [appointment: Appointment] }>()

const api = useApi()
const form = ref<VForm>()
const submitting = ref(false)
const error = ref('')
/** O servidor avisou que o horário fica fora do funcionamento. */
const outsideHours = ref(false)

const draft = reactive({
  patient: null as PatientSummary | null,
  professionalId: '',
  date: '',
  time: '',
  duration: 30,
  notes: '',
})

const editing = computed(() => Boolean(props.appointment))

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  outsideHours.value = false
  const current = props.appointment
  if (current) {
    const start = new Date(current.startsAt)
    Object.assign(draft, {
      patient: null,
      professionalId: current.professional.id,
      date: zonedDate(start, props.timeZone),
      time: zonedClock(start, props.timeZone).time,
      duration: durationMinutes(current),
      notes: current.notes ?? '',
    })
  }
  else {
    Object.assign(draft, {
      patient: null,
      professionalId: props.lockedProfessionalId ?? props.initial?.professionalId ?? '',
      date: props.initial?.date ?? zonedDate(new Date(), props.timeZone),
      time: props.initial?.time ?? '09:00',
      duration: props.defaultMinutes,
      notes: '',
    })
    searchPatients('')
  }
})

// Qualquer mudança no horário pede uma nova confirmação de encaixe
watch(() => [draft.professionalId, draft.date, draft.time, draft.duration], () => {
  outsideHours.value = false
})

// Busca de pacientes ativos
const patientSearch = ref('')
const patients = ref<PatientSummary[]>([])
const searching = ref(false)
let debounce: ReturnType<typeof setTimeout> | undefined

async function searchPatients(search: string) {
  searching.value = true
  try {
    const page = await api<PatientPage>('/patients', {
      query: { search: search.trim() || undefined, status: 'active', pageSize: 20 },
    })
    patients.value = page.items
  }
  catch {
    patients.value = []
  }
  finally {
    searching.value = false
  }
}

watch(patientSearch, (value) => {
  // Ao escolher um paciente, o campo passa a mostrar o nome dele: não busca de novo
  if (draft.patient && value === displayName(draft.patient)) return
  clearTimeout(debounce)
  debounce = setTimeout(() => searchPatients(value ?? ''), 300)
})

const professionalOptions = computed(() => {
  const options = props.professionals.map(professional => ({ value: professional.id, title: professional.name }))
  // Remarcação de um profissional que deixou de estar ativo: mantém o atual visível
  const current = props.appointment?.professional
  if (current && !options.some(option => option.value === current.id)) {
    options.push({ value: current.id, title: current.name })
  }
  return options
})

const durationRule = (value: unknown) => {
  const minutes = Number(value)
  return (Number.isInteger(minutes) && minutes >= 5 && minutes <= 480 && minutes % 5 === 0)
    || 'De 5 a 480 minutos, em múltiplos de 5'
}

const endTime = computed(() => {
  if (!formRules.time(draft.time) || !Number(draft.duration)) return null
  const end = timeToMinutes(draft.time) + Number(draft.duration)
  return end < 24 * 60 ? minutesToTime(end) : null
})

async function submit(allowOutsideBusinessHours = false) {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  const body: Omit<AppointmentPayload, 'patientId'> & { patientId?: string } = {
    professionalId: draft.professionalId,
    startsAt: zonedToInstant(draft.date, draft.time, props.timeZone).toISOString(),
    durationMinutes: Number(draft.duration),
    notes: draft.notes.trim() || null,
    ...(allowOutsideBusinessHours ? { allowOutsideBusinessHours } : {}),
  }
  if (!editing.value) body.patientId = draft.patient!.id

  submitting.value = true
  error.value = ''
  try {
    const saved = await api<Appointment>(
      editing.value ? `/appointments/${props.appointment!.id}` : '/appointments',
      { method: editing.value ? 'PATCH' : 'POST', body },
    )
    emit('saved', saved)
    open.value = false
  }
  catch (err) {
    if (errorCodeOf(err) === 'OUTSIDE_BUSINESS_HOURS') outsideHours.value = true
    else error.value = errorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="620" :persistent="submitting">
    <v-card
      :title="editing ? 'Remarcar agendamento' : 'Novo agendamento'"
      :prepend-icon="editing ? 'mdi-calendar-edit' : 'mdi-calendar-plus'"
    >
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <v-alert
          v-if="editing && appointment?.status === 'CONFIRMED'"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
          text="Ao mudar o horário ou o profissional, o agendamento volta a ficar como não confirmado."
        />

        <v-form ref="form" @submit.prevent="submit()">
          <v-text-field
            v-if="editing && appointment"
            :model-value="displayName(appointment.patient)"
            label="Paciente"
            prepend-inner-icon="mdi-account-heart-outline"
            readonly
            class="mb-2"
          />
          <v-autocomplete
            v-else
            v-model="draft.patient"
            v-model:search="patientSearch"
            :items="patients"
            :item-title="displayName"
            return-object
            no-filter
            :loading="searching"
            label="Paciente"
            placeholder="Busque por nome ou CPF"
            prepend-inner-icon="mdi-account-search-outline"
            no-data-text="Nenhum paciente ativo encontrado"
            class="mb-2"
            :rules="[(value: unknown) => Boolean(value) || 'Escolha o paciente']"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :subtitle="formatCpf(item.cpf)" />
            </template>
          </v-autocomplete>

          <v-select
            v-model="draft.professionalId"
            :items="professionalOptions"
            label="Profissional"
            prepend-inner-icon="mdi-stethoscope"
            :disabled="Boolean(lockedProfessionalId)"
            no-data-text="Nenhum profissional ativo. Dê o papel de profissional a alguém da equipe."
            class="mb-2"
            :rules="[formRules.required('Escolha o profissional')]"
          />

          <v-row density="compact">
            <v-col cols="12" sm="5">
              <v-text-field v-model="draft.date" label="Data" type="date" :rules="[formRules.required()]" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model="draft.time" label="Início" type="time" step="300" :rules="[formRules.time]" />
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model.number="draft.duration"
                label="Duração"
                type="number"
                min="5"
                max="480"
                step="5"
                suffix="min"
                :hint="endTime ? `Termina às ${endTime}` : undefined"
                persistent-hint
                :rules="[durationRule]"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="draft.notes"
            label="Observação (opcional)"
            hint="Visível para a equipe. Não use para informações clínicas: elas vão no prontuário."
            persistent-hint
            rows="2"
            auto-grow
            counter="500"
            class="mt-2"
            :rules="[(value: unknown) => String(value ?? '').length <= 500 || 'Máximo de 500 caracteres']"
          />
        </v-form>

        <v-alert
          v-if="outsideHours"
          type="warning"
          variant="tonal"
          class="mt-4"
          icon="mdi-clock-alert-outline"
          title="Fora do horário de funcionamento"
        >
          A clínica não está aberta em todo esse horário. Quer marcar mesmo assim, como encaixe?
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Voltar</v-btn>
        <v-btn v-if="outsideHours" color="warning" variant="flat" :loading="submitting" @click="submit(true)">
          Marcar como encaixe
        </v-btn>
        <v-btn v-else color="primary" variant="flat" :loading="submitting" @click="submit()">
          {{ editing ? 'Salvar' : 'Agendar' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
