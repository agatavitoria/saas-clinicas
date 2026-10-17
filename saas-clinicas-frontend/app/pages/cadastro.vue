<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { ClinicResponse } from '~/types/clinic'

useHead({ title: 'Cadastrar clínica · SaaS Clínicas' })

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
const form = reactive(createEmptySignupForm())
const submitting = ref(false)
const created = ref<ClinicResponse | null>(null)
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

function back() {
  step.value--
}

function statusOf(error: unknown): number | undefined {
  return (error as { statusCode?: number })?.statusCode
}

function showError(text: string) {
  snackbar.text = text
  snackbar.show = true
}

async function submit() {
  submitting.value = true
  try {
    created.value = await api<ClinicResponse>('/clinics', {
      method: 'POST',
      body: toCreateClinicPayload(form),
    })
  }
  catch (error) {
    const status = statusOf(error)
    if (status === 409) {
      emailError.value = 'Este e-mail já está em uso'
      step.value = ADMIN_STEP
      showError('Já existe uma conta com o e-mail do administrador.')
    }
    else if (status === 400) {
      showError('Alguns dados não foram aceitos. Revise as informações e tente novamente.')
    }
    else {
      showError('Não foi possível conectar ao servidor. Tente novamente em instantes.')
    }
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-container class="py-8" max-width="840">
    <template v-if="created">
      <v-card class="text-center pa-8" elevation="1">
        <v-icon icon="mdi-check-circle" color="success" size="72" class="mb-4" />
        <h1 class="text-h5 font-weight-bold mb-2">Clínica cadastrada!</h1>
        <p class="text-body-1 text-medium-emphasis mb-6">
          <strong>{{ created.clinic.name }}</strong> está pronta. Em breve você
          poderá entrar com o e-mail <strong>{{ created.admin.email }}</strong>.
        </p>
        <v-btn color="primary" to="/" variant="flat">Voltar ao início</v-btn>
      </v-card>
    </template>

    <template v-else>
      <div class="mb-6">
        <h1 class="text-h4 font-weight-bold">Cadastre sua clínica</h1>
        <p class="text-body-1 text-medium-emphasis">
          São só quatro passos. Você poderá alterar tudo depois.
        </p>
      </div>

      <v-stepper
        v-model="step"
        :items="STEPS"
        :mobile="smAndDown"
        alt-labels
        hide-actions
        color="primary"
        elevation="1"
        rounded="xl"
      >
        <template #[`item.1`]>
          <SignupClinicStep ref="clinicStep" v-model="form.clinic" />
        </template>

        <template #[`item.2`]>
          <SignupHoursStep ref="hoursStep" v-model="form.businessHours" />
        </template>

        <template #[`item.3`]>
          <SignupAdminStep
            ref="adminStep"
            v-model="form.admin"
            :email-error="emailError"
            @clear-email-error="emailError = undefined"
          />
        </template>

        <template #[`item.4`]>
          <SignupReviewStep :form="form" @edit="target => (step = target)" />
        </template>

        <v-divider />
        <div class="d-flex justify-space-between pa-4">
          <v-btn
            variant="text"
            prepend-icon="mdi-arrow-left"
            :disabled="step === 1 || submitting"
            @click="back"
          >
            Voltar
          </v-btn>

          <v-btn
            v-if="step < LAST_STEP"
            color="primary"
            variant="flat"
            append-icon="mdi-arrow-right"
            @click="next"
          >
            Continuar
          </v-btn>
          <v-btn
            v-else
            color="primary"
            variant="flat"
            prepend-icon="mdi-check"
            :loading="submitting"
            @click="submit"
          >
            Criar clínica
          </v-btn>
        </div>
      </v-stepper>
    </template>

    <v-snackbar v-model="snackbar.show" color="error" timeout="6000" location="bottom">
      {{ snackbar.text }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Fechar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>
