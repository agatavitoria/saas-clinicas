<script setup lang="ts">
import type { BusinessHour, ClinicDetails } from '~/types/clinic'

const props = withDefaults(
  defineProps<{
    businessHours: BusinessHour[]
    readOnly?: boolean
  }>(),
  { readOnly: false },
)

const emit = defineEmits<{
  'update:clinic': [clinic: ClinicDetails]
  'notify': [text: string, color?: string]
}>()

const api = useApi()
const hoursStep = ref<{ validate: () => Promise<boolean> }>()
const draft = ref(toHoursForm(props.businessHours))
const saving = ref(false)

watch(() => props.businessHours, (hours) => {
  draft.value = toHoursForm(hours)
})

const changed = computed(() =>
  JSON.stringify(fromHoursForm(draft.value)) !== JSON.stringify(fromHoursForm(toHoursForm(props.businessHours))),
)

async function save() {
  if (!changed.value || !(await hoursStep.value?.validate())) return

  saving.value = true
  try {
    const clinic = await api<ClinicDetails>('/clinics/me/business-hours', {
      method: 'PUT',
      body: { businessHours: fromHoursForm(draft.value) },
    })
    emit('update:clinic', clinic)
    emit('notify', 'Horário de funcionamento salvo.')
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
  <div>
    <ClinicFormHoursStep
      ref="hoursStep"
      v-model="draft"
      hint="A agenda avisa quando um horário marcado fica fora do funcionamento."
      :disabled="readOnly"
    />
    <div class="d-flex justify-end ga-2 mt-4">
      <v-btn variant="text" :disabled="readOnly || !changed || saving" @click="draft = toHoursForm(businessHours)">
        Descartar
      </v-btn>
      <v-btn color="primary" variant="flat" :disabled="readOnly || !changed" :loading="saving" @click="save">
        Salvar horário
      </v-btn>
    </div>
  </div>
</template>
