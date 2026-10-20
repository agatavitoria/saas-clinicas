<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { ClinicResponse } from '~/types/clinic'

definePageMeta({ layout: 'master', middleware: 'platform-auth' })
useHead({ title: 'Nova clínica · Master' })

type StepRef = { validate: () => Promise<boolean> }

const STEPS = [
  { title: 'Clínica', value: 1 },
  { title: 'Horários', value: 2 },
  { title: 'Administrador', value: 3 },
  { title: 'Revisão', value: 4 },
]
const LAST_STEP = STEPS.length
const ADMIN_STEP = 3

const api = useApi()
const { smAndDown } = useDisplay()

const step = ref(1)
const form = reactive(createEmptyClinicForm())
const submitting = ref(false)
const created = ref<{ response: ClinicResponse, temporaryPassword: string } | null>(null)
const emailError = ref<string>()
const snackbar = reactive({ show: false, text: '' })

const clinicStep = ref<StepRef>()
const hoursStep = ref<StepRef>()
const adminStep = ref<StepRef>()

const stepRefs: Record<number, Ref<StepRef | undefined>> = {
  1: clinicStep,
  2: hoursStep,
  3: adminStep,
}

async function next() {
  const valid = (await stepRefs[step.value]?.value?.validate()) ?? true
  if (valid) step.value++
}

function reset() {
  Object.assign(form, createEmptyClinicForm())
  created.value = null
  step.value = 1
}

async function submit() {
  submitting.value = true
  try {
    const response = await api<ClinicResponse>('/platform/clinics', {
      method: 'POST',
      body: toCreateClinicPayload(form),
    })
    created.value = { response, temporaryPassword: form.admin.temporaryPassword }
  }
  catch (error) {
    if (errorCodeOf(error) === 'EMAIL_IN_USE') {
      emailError.value = errorMessage(error)
      step.value = ADMIN_STEP
    }
    snackbar.text = errorMessage(error)
    snackbar.show = true
  }
  finally {
    submitting.value = false
  }
}

async function copyCredentials() {
  if (!created.value) return
  const { response, temporaryPassword } = created.value
  await navigator.clipboard.writeText(
    `Acesse ${window.location.origin}/login\nE-mail: ${response.admin.email}\nSenha provisória: ${temporaryPassword}`,
  )
}
</script>

<template>
  <v-container class="py-6" max-width="840">
    <template v-if="created">
      <v-card class="text-center pa-8" elevation="1">
        <v-icon icon="mdi-check-circle" color="success" size="72" class="mb-4" />
        <h1 class="text-h5 font-weight-bold mb-2">Clínica criada!</h1>
        <p class="text-body-1 text-medium-emphasis mb-6">
          Repasse os dados de acesso para o administrador de
          <strong>{{ created.response.clinic.name }}</strong>. A senha
          provisória precisa ser trocada no primeiro acesso.
        </p>
        <v-sheet color="surface-variant" rounded="lg" class="pa-4 mb-6 text-start font-monospace mx-auto" max-width="420">
          <div>E-mail: {{ created.response.admin.email }}</div>
          <div>Senha provisória: <strong>{{ created.temporaryPassword }}</strong></div>
        </v-sheet>
        <div class="d-flex flex-wrap justify-center ga-2">
          <v-btn variant="tonal" prepend-icon="mdi-content-copy" @click="copyCredentials">Copiar acesso</v-btn>
          <v-btn variant="text" @click="reset">Criar outra</v-btn>
          <v-btn color="tertiary" variant="flat" :to="`/master/clinicas/${created.response.clinic.id}`">
            Ver clínica
          </v-btn>
        </div>
      </v-card>
    </template>

    <template v-else>
      <div class="mb-6">
        <h1 class="text-h4 font-weight-bold">Nova clínica</h1>
        <p class="text-body-1 text-medium-emphasis">
          Cadastre a clínica e o administrador dela. Ele recebe uma senha
          provisória e cadastra o restante da equipe.
        </p>
      </div>

      <v-stepper
        v-model="step"
        :items="STEPS"
        :mobile="smAndDown"
        alt-labels
        hide-actions
        color="tertiary"
        elevation="1"
        rounded="xl"
      >
        <template #[`item.1`]>
          <ClinicFormClinicStep ref="clinicStep" v-model="form.clinic" />
        </template>
        <template #[`item.2`]>
          <ClinicFormHoursStep ref="hoursStep" v-model="form.businessHours" />
        </template>
        <template #[`item.3`]>
          <ClinicFormAdminStep
            ref="adminStep"
            v-model="form.admin"
            :email-error="emailError"
            @clear-email-error="emailError = undefined"
          />
        </template>
        <template #[`item.4`]>
          <ClinicFormReviewStep :form="form" @edit="target => (step = target)" />
        </template>

        <v-divider />
        <div class="d-flex justify-space-between pa-4">
          <v-btn
            variant="text"
            prepend-icon="mdi-arrow-left"
            :disabled="step === 1 || submitting"
            @click="step--"
          >
            Voltar
          </v-btn>
          <v-btn v-if="step < LAST_STEP" color="tertiary" variant="flat" append-icon="mdi-arrow-right" @click="next">
            Continuar
          </v-btn>
          <v-btn v-else color="tertiary" variant="flat" prepend-icon="mdi-check" :loading="submitting" @click="submit">
            Criar clínica
          </v-btn>
        </div>
      </v-stepper>
    </template>

    <v-snackbar v-model="snackbar.show" color="error" timeout="6000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
