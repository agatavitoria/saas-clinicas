<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { PatientDetails, PatientPayload } from '~/types/patient'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** Sem paciente: cadastro novo. Com paciente: edição. */
  patient?: PatientDetails | null
}>()

const emit = defineEmits<{ saved: [patient: PatientDetails] }>()

const api = useApi()

const form = ref<VForm>()
const values = ref<PatientPayload>(emptyPatientPayload())
const submitting = ref(false)
const cpfError = ref<string>()
const error = ref('')

const isEdit = computed(() => Boolean(props.patient))
const today = new Date().toISOString().slice(0, 10)

watch(open, (isOpen) => {
  if (!isOpen) return
  values.value = props.patient ? toPatientForm(props.patient) : emptyPatientPayload()
  cpfError.value = undefined
  error.value = ''
})

async function submit() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  error.value = ''
  try {
    const body = toPatientPayload(values.value)
    const saved = props.patient
      ? await api<PatientDetails>(`/patients/${props.patient.id}`, { method: 'PATCH', body })
      : await api<PatientDetails>('/patients', { method: 'POST', body })
    emit('saved', saved)
    open.value = false
  }
  catch (err) {
    if (errorCodeOf(err) === 'CPF_IN_USE') cpfError.value = errorMessage(err)
    else error.value = errorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="720" :persistent="submitting" scrollable>
    <v-card :title="isEdit ? 'Editar paciente' : 'Novo paciente'" prepend-icon="mdi-account-heart-outline">
      <v-divider />
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <v-form ref="form" @submit.prevent="submit">
          <div class="text-subtitle-2 text-medium-emphasis mb-2">Identificação</div>
          <v-row density="compact">
            <v-col cols="12" md="8">
              <v-text-field
                v-model="values.name"
                label="Nome completo *"
                autocomplete="off"
                autofocus
                :rules="[formRules.required(), formRules.minLength(2)]"
              />
            </v-col>
            <v-col cols="12" md="4">
              <MaskedTextField
                v-model="values.cpf"
                mask="cpf"
                label="CPF *"
                placeholder="000.000.000-00"
                :error-messages="cpfError"
                :rules="[formRules.required(), formRules.cpf]"
                @update:model-value="cpfError = undefined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="values.birthDate"
                label="Data de nascimento *"
                type="date"
                :max="today"
                :rules="[formRules.required(), formRules.pastDate]"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="values.socialName"
                label="Nome social"
                hint="Usado no atendimento, no lugar do nome civil"
                autocomplete="off"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="values.gender"
                label="Gênero"
                variant="outlined"
                density="comfortable"
                :items="GENDER_OPTIONS"
                clearable
              />
            </v-col>
          </v-row>

          <div class="text-subtitle-2 text-medium-emphasis mb-2 mt-2">Contato</div>
          <v-row density="compact">
            <v-col cols="12" md="6">
              <MaskedTextField
                v-model="values.phone"
                mask="phone"
                label="Telefone"
                type="tel"
                placeholder="(11) 99999-8888"
                prepend-inner-icon="mdi-phone-outline"
                :rules="[formRules.phone]"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="values.email"
                label="E-mail"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                :rules="[formRules.email]"
              />
            </v-col>
          </v-row>

          <div class="text-subtitle-2 text-medium-emphasis mb-2 mt-2">Contato de emergência</div>
          <v-row density="compact">
            <v-col cols="12" md="6">
              <v-text-field v-model="values.emergencyContactName" label="Nome" prepend-inner-icon="mdi-account-outline" />
            </v-col>
            <v-col cols="12" md="6">
              <MaskedTextField
                v-model="values.emergencyContactPhone"
                mask="phone"
                label="Telefone"
                type="tel"
                placeholder="(11) 99999-8888"
                prepend-inner-icon="mdi-phone-outline"
                :rules="[formRules.phone]"
              />
            </v-col>
          </v-row>
          <p class="text-caption text-medium-emphasis">* Campos obrigatórios</p>
        </v-form>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="submitting" @click="submit">
          {{ isEdit ? 'Salvar' : 'Cadastrar' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
