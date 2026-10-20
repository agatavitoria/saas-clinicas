<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { CreateUserPayload, TeamMember, UserRole } from '~/types/auth'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** Ex.: /users ou /platform/clinics/:id/users */
  basePath: string
}>()

const emit = defineEmits<{ created: [user: TeamMember, temporaryPassword: string] }>()

const api = useApi()

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map(value => ({
  value,
  title: ROLE_LABELS[value],
}))

const empty = (): CreateUserPayload => ({
  name: '',
  email: '',
  role: 'PROFESSIONAL',
  temporaryPassword: generateTemporaryPassword(),
})

const form = ref<VForm>()
const values = ref(empty())
const submitting = ref(false)
const emailError = ref<string>()
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  values.value = empty()
  emailError.value = undefined
  error.value = ''
})

async function submit() {
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  error.value = ''
  try {
    const user = await api<TeamMember>(props.basePath, {
      method: 'POST',
      body: { ...values.value, name: values.value.name.trim(), email: values.value.email.trim() },
    })
    emit('created', user, values.value.temporaryPassword)
    open.value = false
  }
  catch (err) {
    if (errorCodeOf(err) === 'EMAIL_IN_USE') emailError.value = errorMessage(err)
    else error.value = errorMessage(err)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" :persistent="submitting">
    <v-card title="Novo usuário" prepend-icon="mdi-account-plus-outline">
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />

        <v-form ref="form" @submit.prevent="submit">
          <v-text-field
            v-model="values.name"
            label="Nome completo"
            prepend-inner-icon="mdi-account-outline"
            autocomplete="off"
            autofocus
            class="mb-2"
            :rules="[formRules.required(), formRules.minLength(2)]"
          />
          <v-text-field
            v-model="values.email"
            label="E-mail de acesso"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            autocomplete="off"
            class="mb-2"
            :error-messages="emailError"
            :rules="[formRules.required(), formRules.email]"
            @update:model-value="emailError = undefined"
          />
          <v-select
            v-model="values.role"
            label="Papel"
            prepend-inner-icon="mdi-badge-account-outline"
            variant="outlined"
            density="comfortable"
            class="mb-2"
            :items="ROLE_OPTIONS"
          />
          <TemporaryPasswordField v-model="values.temporaryPassword" />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="submitting" @click="submit">
          Criar usuário
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
