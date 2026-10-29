<script setup lang="ts">
import type { Appointment, AppointmentStatus } from '~/types/appointment'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  appointment: Appointment | null
  timeZone: string
  /** Recepção, admin ou o próprio profissional */
  canManage: boolean
  readOnly: boolean
}>()

const emit = defineEmits<{
  updated: [appointment: Appointment]
  reschedule: [appointment: Appointment]
}>()

const api = useApi()
const saving = ref<AppointmentStatus | null>(null)
const error = ref('')
const cancelling = ref(false)
const cancelReason = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  cancelling.value = false
  cancelReason.value = ''
})

const status = computed(() => (props.appointment ? APPOINTMENT_STATUS[props.appointment.status] : null))
const editable = computed(() => props.canManage && !props.readOnly)

const actions = computed(() => {
  const appointment = props.appointment
  if (!appointment || !editable.value) return []
  const started = hasStarted(appointment)
  return [
    { status: 'CONFIRMED' as const, label: 'Confirmar', icon: 'mdi-calendar-check', color: 'success' },
    { status: 'COMPLETED' as const, label: 'Realizado', icon: 'mdi-check-circle-outline', color: 'info', needsStart: true },
    { status: 'NO_SHOW' as const, label: 'Faltou', icon: 'mdi-account-cancel-outline', color: 'error', needsStart: true },
  ].filter(action => canTransition(appointment.status, action.status) && (!action.needsStart || started))
})

async function changeStatus(next: AppointmentStatus) {
  if (!props.appointment) return
  saving.value = next
  error.value = ''
  try {
    const updated = await api<Appointment>(`/appointments/${props.appointment.id}/status`, {
      method: 'PATCH',
      body: {
        status: next,
        ...(next === 'CANCELLED' ? { cancelReason: cancelReason.value.trim() || null } : {}),
      },
    })
    emit('updated', updated)
    cancelling.value = false
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    saving.value = null
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :persistent="Boolean(saving)">
    <v-card v-if="appointment && status">
      <v-card-item>
        <template #prepend>
          <v-avatar :color="status.color" variant="tonal">
            <v-icon :icon="status.icon" />
          </v-avatar>
        </template>
        <v-card-title>{{ displayName(appointment.patient) }}</v-card-title>
        <v-card-subtitle>{{ appointment.professional.name }}</v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" aria-label="Fechar" @click="open = false" />
        </template>
      </v-card-item>

      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-chip :color="status.color" :prepend-icon="status.icon" size="small" variant="flat">
            {{ status.label }}
          </v-chip>
          <v-chip v-if="appointment.outsideBusinessHours" color="warning" prepend-icon="mdi-clock-alert-outline" size="small">
            Encaixe
          </v-chip>
        </div>

        <v-list density="compact" class="py-0">
          <v-list-item prepend-icon="mdi-calendar-outline" class="px-0">
            <v-list-item-title class="text-capitalize-first">
              {{ formatLongDate(zonedDate(new Date(appointment.startsAt), timeZone)) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ appointmentTimeRange(appointment, timeZone) }} · {{ durationMinutes(appointment) }} min
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="appointment.notes" prepend-icon="mdi-note-text-outline" class="px-0">
            <v-list-item-title class="text-wrap">{{ appointment.notes }}</v-list-item-title>
            <v-list-item-subtitle>Observação</v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="appointment.status === 'CANCELLED' && appointment.cancelReason" prepend-icon="mdi-comment-remove-outline" class="px-0">
            <v-list-item-title class="text-wrap">{{ appointment.cancelReason }}</v-list-item-title>
            <v-list-item-subtitle>Motivo do cancelamento</v-list-item-subtitle>
          </v-list-item>
          <v-list-item prepend-icon="mdi-account-heart-outline" class="px-0" :to="`/painel/pacientes/${appointment.patient.id}`">
            <v-list-item-title>Abrir ficha do paciente</v-list-item-title>
          </v-list-item>
        </v-list>

        <template v-if="cancelling">
          <v-divider class="my-4" />
          <v-textarea
            v-model="cancelReason"
            label="Motivo do cancelamento (opcional)"
            rows="2"
            auto-grow
            counter="500"
            autofocus
            :rules="[(value: unknown) => String(value ?? '').length <= 500 || 'Máximo de 500 caracteres']"
          />
        </template>

        <p v-else-if="editable && isOpenAppointment(appointment) && !hasStarted(appointment)" class="text-caption text-medium-emphasis mt-2">
          "Realizado" e "Faltou" ficam disponíveis a partir do horário marcado.
        </p>
      </v-card-text>

      <v-card-actions v-if="cancelling" class="flex-wrap">
        <v-spacer />
        <v-btn variant="text" :disabled="Boolean(saving)" @click="cancelling = false">Voltar</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="saving === 'CANCELLED'"
          :disabled="cancelReason.length > 500"
          @click="changeStatus('CANCELLED')"
        >
          Cancelar agendamento
        </v-btn>
      </v-card-actions>

      <v-card-actions v-else-if="editable && isOpenAppointment(appointment)" class="flex-wrap ga-1">
        <v-btn
          v-for="action in actions"
          :key="action.status"
          :color="action.color"
          :prepend-icon="action.icon"
          variant="tonal"
          :loading="saving === action.status"
          :disabled="Boolean(saving) && saving !== action.status"
          @click="changeStatus(action.status)"
        >
          {{ action.label }}
        </v-btn>
        <v-spacer />
        <v-btn prepend-icon="mdi-calendar-edit" variant="text" :disabled="Boolean(saving)" @click="emit('reschedule', appointment)">
          Remarcar
        </v-btn>
        <v-btn color="error" prepend-icon="mdi-calendar-remove" variant="text" :disabled="Boolean(saving)" @click="cancelling = true">
          Cancelar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.text-capitalize-first::first-letter {
  text-transform: uppercase;
}
</style>
