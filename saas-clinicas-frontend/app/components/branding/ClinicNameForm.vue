<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicDetails } from '~/types/clinic'

const props = withDefaults(
  defineProps<{
    name: string
    /** PATCH /clinics/me (admin) ou /platform/clinics/:id (master). */
    path: string
    readOnly?: boolean
  }>(),
  { readOnly: false },
)

const emit = defineEmits<{
  'update:clinic': [clinic: ClinicDetails]
  'notify': [text: string, color?: string]
}>()

const api = useApi()
const form = ref<VForm>()
const draft = ref(props.name)
const saving = ref(false)

watch(() => props.name, (name) => {
  draft.value = name
})

const changed = computed(() => draft.value.trim() !== props.name)

async function save() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid || !changed.value) return

  saving.value = true
  try {
    const clinic = await api<ClinicDetails>(props.path, {
      method: 'PATCH',
      body: { name: draft.value.trim() },
    })
    emit('update:clinic', clinic)
    emit('notify', 'Nome da clínica salvo.')
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
  <v-form ref="form" class="d-flex flex-wrap align-start ga-2" @submit.prevent="save">
    <v-text-field
      v-model="draft"
      label="Nome da clínica"
      counter="120"
      :disabled="readOnly"
      :rules="[
        formRules.required(),
        (value: unknown) => String(value ?? '').trim().length >= 2 || 'Mínimo de 2 caracteres',
        (value: unknown) => String(value ?? '').trim().length <= 120 || 'Máximo de 120 caracteres',
      ]"
      style="max-width: 480px; min-width: 240px"
    />
    <v-btn
      type="submit"
      color="primary"
      variant="flat"
      class="mt-2"
      :disabled="readOnly || !changed"
      :loading="saving"
    >
      Salvar nome
    </v-btn>
  </v-form>
</template>
