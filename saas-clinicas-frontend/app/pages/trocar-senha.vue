<script setup lang="ts">
import type { VForm } from 'vuetify/components'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Trocar senha · SaaS Clínicas' })

const { user, changePassword, logout } = useAuth()

const form = ref<VForm>()
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const showPasswords = ref(false)
const submitting = ref(false)
const error = ref('')

const isTemporary = computed(() => user.value?.mustChangePassword ?? false)

async function submit() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  error.value = ''
  try {
    await changePassword(currentPassword.value, newPassword.value)
    await navigateTo('/painel')
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
  <v-container class="fill-height py-8" max-width="480">
    <v-card class="w-100 pa-4 pa-sm-6" elevation="1">
      <v-card-item class="text-center pb-2">
        <v-avatar color="primary" variant="tonal" size="56" class="mb-4">
          <v-icon icon="mdi-lock-reset" size="28" />
        </v-avatar>
        <v-card-title class="text-h5 font-weight-bold">
          {{ isTemporary ? 'Crie sua senha' : 'Trocar senha' }}
        </v-card-title>
        <v-card-subtitle class="text-wrap">
          {{ isTemporary
            ? 'Você entrou com uma senha provisória. Defina uma senha só sua para continuar.'
            : 'Escolha uma nova senha para a sua conta.' }}
        </v-card-subtitle>
      </v-card-item>

      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="currentPassword"
            :label="isTemporary ? 'Senha provisória' : 'Senha atual'"
            :type="showPasswords ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPasswords ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="current-password"
            autofocus
            class="mb-2"
            :rules="[formRules.required()]"
            @click:append-inner="showPasswords = !showPasswords"
          />
          <v-text-field
            v-model="newPassword"
            label="Nova senha"
            :type="showPasswords ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-plus-outline"
            autocomplete="new-password"
            :hint="`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`"
            counter
            class="mb-2"
            :rules="[
              formRules.required(),
              formRules.minLength(MIN_PASSWORD_LENGTH),
              (value: unknown) => value !== currentPassword || 'Use uma senha diferente da atual',
            ]"
          />
          <v-text-field
            v-model="confirmation"
            label="Confirme a nova senha"
            :type="showPasswords ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-check-outline"
            autocomplete="new-password"
            :rules="[formRules.required(), formRules.sameAs(() => newPassword, 'As senhas não conferem')]"
          />

          <v-btn type="submit" color="primary" variant="flat" size="large" block class="mt-4" :loading="submitting">
            Salvar senha
          </v-btn>
        </v-form>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn v-if="isTemporary" variant="text" size="small" @click="logout">Sair</v-btn>
        <v-btn v-else variant="text" size="small" to="/painel">Voltar ao painel</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
