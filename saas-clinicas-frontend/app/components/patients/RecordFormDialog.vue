<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { PatientRecord } from '~/types/patient'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  patientId: string
  /** Preenchido: adendo a este registro. Vazio: novo atendimento. */
  amending?: PatientRecord | null
}>()

const emit = defineEmits<{ saved: [] }>()

const api = useApi()

const form = ref<VForm>()
const notes = ref('')
const occurredAt = ref('')
const submitting = ref(false)
const error = ref('')

/** "agora" no formato do input datetime-local, no fuso de quem usa */
const nowLocal = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

watch(open, (isOpen) => {
  if (!isOpen) return
  notes.value = ''
  occurredAt.value = nowLocal()
  error.value = ''
})

async function submit() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  error.value = ''
  try {
    if (props.amending) {
      await api(`/patients/${props.patientId}/records/${props.amending.id}/amendments`, {
        method: 'POST',
        body: { notes: notes.value.trim() },
      })
    }
    else {
      await api(`/patients/${props.patientId}/records`, {
        method: 'POST',
        body: { notes: notes.value.trim(), occurredAt: new Date(occurredAt.value).toISOString() },
      })
    }
    emit('saved')
    open.value = false
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="680" :persistent="submitting">
    <v-card
      :title="amending ? 'Adicionar adendo' : 'Registrar atendimento'"
      :prepend-icon="amending ? 'mdi-clipboard-edit-outline' : 'mdi-clipboard-text-outline'"
    >
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <v-alert v-if="amending" type="info" variant="tonal" density="compact" class="mb-4">
          Registros de atendimento não podem ser alterados. O adendo fica vinculado ao registro
          de {{ formatDateTime(amending.occurredAt) }}, com data e autor.
        </v-alert>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">
          Depois de salvo, o registro não pode ser alterado nem excluído. Correções entram como adendo.
        </p>

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-if="!amending"
            v-model="occurredAt"
            label="Data e hora do atendimento"
            type="datetime-local"
            :max="nowLocal()"
            class="mb-2"
            :rules="[formRules.required()]"
          />
          <v-textarea
            v-model="notes"
            :label="amending ? 'Texto do adendo' : 'Anotações do atendimento'"
            variant="outlined"
            rows="6"
            auto-grow
            counter="20000"
            autofocus
            :rules="[
              formRules.required(),
              (value: unknown) => String(value ?? '').length <= 20000 || 'Máximo de 20.000 caracteres',
            ]"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="submitting" @click="submit">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
