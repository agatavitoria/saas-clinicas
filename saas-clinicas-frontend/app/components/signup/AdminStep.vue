<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicSignupForm } from '~/types/clinic'

const admin = defineModel<ClinicSignupForm['admin']>({ required: true })

defineProps<{
  /** Erro vindo do servidor (ex.: e-mail já cadastrado). */
  emailError?: string
}>()

const emit = defineEmits<{ 'clear-email-error': [] }>()

const form = ref<VForm>()
const showPassword = ref(false)

const MIN_PASSWORD_LENGTH = 8

defineExpose({
  validate: async () => (await form.value?.validate())?.valid ?? false,
})
</script>

<template>
  <v-form ref="form" @submit.prevent>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Esta pessoa será a administradora da clínica e poderá cadastrar o
      restante da equipe.
    </p>

    <v-row density="compact">
      <v-col cols="12">
        <v-text-field
          v-model="admin.name"
          label="Nome completo"
          prepend-inner-icon="mdi-account-outline"
          autocomplete="name"
          :rules="[formRules.required(), formRules.minLength(2)]"
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="admin.email"
          label="E-mail de acesso"
          type="email"
          prepend-inner-icon="mdi-email-outline"
          autocomplete="username"
          hint="Será usado para entrar no sistema"
          persistent-hint
          :error-messages="emailError"
          :rules="[formRules.required(), formRules.email]"
          @update:model-value="emit('clear-email-error')"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="admin.password"
          label="Senha"
          :type="showPassword ? 'text' : 'password'"
          prepend-inner-icon="mdi-lock-outline"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          autocomplete="new-password"
          :hint="`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`"
          counter
          :rules="[formRules.required(), formRules.minLength(MIN_PASSWORD_LENGTH)]"
          @click:append-inner="showPassword = !showPassword"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="admin.passwordConfirmation"
          label="Confirme a senha"
          :type="showPassword ? 'text' : 'password'"
          prepend-inner-icon="mdi-lock-check-outline"
          autocomplete="new-password"
          :rules="[
            formRules.required(),
            formRules.sameAs(() => admin.password, 'As senhas não conferem'),
          ]"
        />
      </v-col>
    </v-row>
  </v-form>
</template>
