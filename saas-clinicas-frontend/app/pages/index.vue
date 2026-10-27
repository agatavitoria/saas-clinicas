<script setup lang="ts">
import type { VForm } from 'vuetify/components'

useHead({ title: 'SaaS Clínicas' })

const api = useApi()
const { clinicUrl, clinicHostSuffix } = useAreaUrls()

const form = ref<VForm>()
const slug = ref('')
const searching = ref(false)
const slugError = ref('')

/** Confere se o endereço existe antes de sair da página. */
async function goToClinic() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  const value = slug.value.trim().toLowerCase()
  searching.value = true
  slugError.value = ''
  try {
    await api(`/public/clinics/${value}`)
    await navigateTo(`${clinicUrl(value)}/login`, { external: true })
  }
  catch (error) {
    slugError.value = errorMessage(error)
  }
  finally {
    searching.value = false
  }
}

const features = [
  { icon: 'mdi-calendar-clock', title: 'Agenda por profissional', text: 'Cada profissional com seus horários e atendimentos.' },
  { icon: 'mdi-account-group-outline', title: 'Pacientes organizados', text: 'Cadastro e histórico de agendamentos em um só lugar.' },
  { icon: 'mdi-shield-lock-outline', title: 'Dados isolados', text: 'As informações da sua clínica são só da sua clínica.' },
]
</script>

<template>
  <v-container class="py-12" max-width="1080">
    <v-row align="center" justify="center">
      <v-col cols="12" md="7" class="text-center text-md-start">
        <h1 class="text-h3 font-weight-bold mb-4">
          A agenda da sua clínica, simples e organizada
        </h1>
        <p class="text-h6 text-medium-emphasis font-weight-regular mb-8">
          Organize profissionais, pacientes e agendamentos da sua clínica em um
          só lugar.
        </p>
        <v-form ref="form" class="clinic-address" @submit.prevent="goToClinic">
          <p class="text-body-1 font-weight-medium mb-2">
            Qual é o endereço da sua clínica?
          </p>
          <v-text-field
            v-model="slug"
            label="Endereço da clínica"
            placeholder="minha-clinica"
            :suffix="clinicHostSuffix"
            prepend-inner-icon="mdi-web"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
            :error-messages="slugError"
            :rules="[formRules.required('Informe o endereço da clínica'), value => formRules.slug(String(value).toLowerCase())]"
            @update:model-value="slugError = ''"
          />
          <v-btn
            type="submit"
            color="primary"
            size="x-large"
            prepend-icon="mdi-login"
            :loading="searching"
          >
            Entrar no painel
          </v-btn>
        </v-form>
      </v-col>
    </v-row>

    <v-row class="mt-12">
      <v-col v-for="feature in features" :key="feature.title" cols="12" md="4">
        <v-card variant="tonal" color="primary" class="h-100 pa-2">
          <v-card-item :prepend-icon="feature.icon" :title="feature.title" />
          <v-card-text class="text-high-emphasis">{{ feature.text }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.clinic-address {
  max-width: 480px;
}

@media (max-width: 959px) {
  .clinic-address {
    margin-inline: auto;
  }
}
</style>
