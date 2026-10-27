<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicDetails } from '~/types/clinic'

const props = withDefaults(
  defineProps<{
    timeZone: string
    defaultAppointmentMinutes: number
    readOnly?: boolean
  }>(),
  { readOnly: false },
)

const emit = defineEmits<{
  'update:clinic': [clinic: ClinicDetails]
  'notify': [text: string, color?: string]
}>()

const MIN_MINUTES = 5
const MAX_MINUTES = 240

const api = useApi()
const form = ref<VForm>()
const saving = ref(false)
const draft = reactive({ timeZone: props.timeZone, minutes: props.defaultAppointmentMinutes })
const options = timeZoneOptions()

watch(
  () => [props.timeZone, props.defaultAppointmentMinutes] as const,
  ([timeZone, minutes]) => Object.assign(draft, { timeZone, minutes }),
)

const changed = computed(() =>
  draft.timeZone !== props.timeZone || Number(draft.minutes) !== props.defaultAppointmentMinutes,
)

const minutesRule = (value: unknown) => {
  const minutes = Number(value)
  return (Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES && minutes % 5 === 0)
    || `De ${MIN_MINUTES} a ${MAX_MINUTES} minutos, em múltiplos de 5`
}

async function save() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid || !changed.value) return

  saving.value = true
  try {
    const clinic = await api<ClinicDetails>('/clinics/me/schedule-settings', {
      method: 'PATCH',
      body: { timeZone: draft.timeZone, defaultAppointmentMinutes: Number(draft.minutes) },
    })
    emit('update:clinic', clinic)
    emit('notify', 'Configurações da agenda salvas.')
  }
  catch (error) {
    emit('notify', errorMessage(error), 'error')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <v-form ref="form" :disabled="readOnly" @submit.prevent="save">
    <v-row density="compact">
      <v-col cols="12" md="8">
        <v-autocomplete
          v-model="draft.timeZone"
          :items="options"
          label="Fuso horário"
          hint="Usado na agenda e no horário de funcionamento."
          persistent-hint
          :rules="[formRules.required()]"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model.number="draft.minutes"
          label="Duração padrão da consulta"
          type="number"
          suffix="min"
          :min="MIN_MINUTES"
          :max="MAX_MINUTES"
          step="5"
          hint="Pode ser ajustada em cada agendamento."
          persistent-hint
          :rules="[minutesRule]"
        />
      </v-col>
    </v-row>
    <div class="d-flex justify-end mt-4">
      <v-btn type="submit" color="primary" variant="flat" :disabled="readOnly || !changed" :loading="saving">
        Salvar configurações
      </v-btn>
    </div>
  </v-form>
</template>
