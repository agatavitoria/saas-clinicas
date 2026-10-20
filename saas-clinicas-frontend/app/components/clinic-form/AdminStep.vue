<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicForm } from '~/types/clinic'

const admin = defineModel<ClinicForm['admin']>({ required: true })

defineProps<{
  /** Erro vindo do servidor (ex.: e-mail já cadastrado). */
  emailError?: string
}>()

const emit = defineEmits<{ 'clear-email-error': [] }>()

const form = ref<VForm>()

defineExpose({
  validate: async () => (await form.value?.validate())?.valid ?? false,
})
</script>

<template>
  <v-form ref="form" @submit.prevent>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Esta pessoa será a administradora da clínica e poderá cadastrar o
      restante da equipe. Ela entra com a senha provisória abaixo e define a
      própria senha no primeiro acesso.
    </p>

    <v-row density="compact">
      <v-col cols="12">
        <v-text-field
          v-model="admin.name"
          label="Nome completo"
          prepend-inner-icon="mdi-account-outline"
          autocomplete="off"
          :rules="[formRules.required(), formRules.minLength(2)]"
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="admin.email"
          label="E-mail de acesso"
          type="email"
          prepend-inner-icon="mdi-email-outline"
          autocomplete="off"
          hint="Será usado para entrar no sistema"
          persistent-hint
          :error-messages="emailError"
          :rules="[formRules.required(), formRules.email]"
          @update:model-value="emit('clear-email-error')"
        />
      </v-col>

      <v-col cols="12">
        <TemporaryPasswordField v-model="admin.temporaryPassword" />
      </v-col>
    </v-row>
  </v-form>
</template>
