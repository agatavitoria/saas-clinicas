<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { PublicClinicTheme } from '~/types/clinic'

definePageMeta({ middleware: 'guest' })

// O middleware global garante que esta página só abre no endereço de uma clínica
const hostArea = useHostArea()
const slug = hostArea.area === 'clinic' ? hostArea.slug : ''
const { rootUrl } = useAreaUrls()

// Buscado no SSR: a página já chega com o nome, a cor e o logo da clínica
const { data: clinic, error: clinicError } = await useFetch<PublicClinicTheme>(
  `/api/public/clinics/${slug}`,
  { key: `public-clinic:${slug}` },
)
const clinicNotFound = computed(() => statusOf(clinicError.value) === 404)

useThemePrimaryColor(() => clinic.value?.primaryColor ?? DEFAULT_PRIMARY_COLOR)
useHead({ title: () => `Entrar · ${clinic.value?.name ?? 'SaaS Clínicas'}` })

const clinicLogoUrl = computed(() => logoUrl(`/public/clinics/${slug}/logo`, clinic.value))
const logoFailed = ref(false)

const route = useRoute()
const { login } = useAuth()

const form = ref<VForm>()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const loginError = ref('')

async function submit() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  loginError.value = ''
  try {
    const user = await login(email.value, password.value)
    await navigateTo(user.mustChangePassword ? '/trocar-senha' : safeRedirect(route.query.redirect))
  }
  catch (error) {
    loginError.value
      = statusOf(error) === 401 ? 'E-mail ou senha incorretos.' : errorMessage(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-container class="fill-height py-8" max-width="460">
    <v-card v-if="clinicNotFound" class="w-100 pa-4 pa-sm-6 text-center" elevation="1">
      <v-card-item class="pb-2">
        <v-avatar color="error" variant="tonal" size="56" class="mb-4">
          <v-icon icon="mdi-map-marker-question-outline" size="28" />
        </v-avatar>
        <v-card-title class="text-h5 font-weight-bold">
          Clínica não encontrada
        </v-card-title>
        <v-card-subtitle class="text-wrap">
          Não há uma clínica ativa no endereço <strong>{{ slug }}</strong>.
          Confira o endereço com a sua clínica.
        </v-card-subtitle>
      </v-card-item>
      <v-card-actions class="justify-center">
        <v-btn :href="rootUrl()" variant="tonal" color="primary" prepend-icon="mdi-arrow-left">
          Digitar outro endereço
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-else class="w-100 pa-4 pa-sm-6" elevation="1">
      <v-card-item class="text-center pb-2">
        <img
          v-if="clinicLogoUrl && !logoFailed"
          :src="clinicLogoUrl"
          :alt="`Logo de ${clinic?.name}`"
          class="clinic-logo mb-4"
          @error="logoFailed = true"
        >
        <v-avatar v-else color="primary" variant="tonal" size="56" class="mb-4">
          <v-icon icon="mdi-hospital-building" size="28" />
        </v-avatar>
        <v-card-title class="text-h5 font-weight-bold text-wrap">
          {{ clinic?.name ?? 'Entrar' }}
        </v-card-title>
        <v-card-subtitle class="text-wrap">
          Entre para acessar o painel da clínica
        </v-card-subtitle>
      </v-card-item>

      <v-card-text>
        <v-alert
          v-if="loginError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
          :text="loginError"
        />

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="email"
            label="E-mail"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            autocomplete="username"
            autofocus
            class="mb-2"
            :rules="[formRules.required('Informe seu e-mail'), formRules.email]"
          />

          <v-text-field
            v-model="password"
            label="Senha"
            :type="showPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="current-password"
            :rules="[formRules.required('Informe sua senha')]"
            @click:append-inner="showPassword = !showPassword"
          />

          <v-btn
            type="submit"
            color="primary"
            variant="flat"
            size="large"
            block
            class="mt-4"
            :loading="submitting"
          >
            Entrar
          </v-btn>
        </v-form>
      </v-card-text>

      <v-divider class="mx-4" />

      <v-card-text class="text-center text-body-2 text-medium-emphasis">
        Esqueceu a senha? Peça ao administrador da sua clínica para
        redefini-la.
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.clinic-logo {
  display: block;
  max-width: 100%;
  max-height: 72px;
  margin-inline: auto;
  object-fit: contain;
}
</style>
