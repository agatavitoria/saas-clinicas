<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { TeamMember } from '~/types/auth'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  basePath: string
  user: TeamMember | null
}>()

const emit = defineEmits<{ reset: [user: TeamMember, temporaryPassword: string] }>()

const api = useApi()

const form = ref<VForm>()
const temporaryPassword = ref('')
const submitting = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  temporaryPassword.value = generateTemporaryPassword()
  error.value = ''
})

async function submit() {
  if (!props.user) return
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) return

  submitting.value = true
  error.value = ''
  try {
    const user = await api<TeamMember>(`${props.basePath}/${props.user.id}/reset-password`, {
      method: 'POST',
      body: { temporaryPassword: temporaryPassword.value },
    })
    emit('reset', user, temporaryPassword.value)
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
  <v-dialog v-model="open" max-width="520" :persistent="submitting">
    <v-card title="Redefinir senha" prepend-icon="mdi-lock-reset">
      <v-card-text>
        <p class="mb-4">
          <strong>{{ user?.name }}</strong> receberá uma nova senha provisória e
          precisará trocá-la no próximo acesso. As sessões abertas serão
          encerradas.
        </p>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />
        <v-form ref="form" @submit.prevent="submit">
          <TemporaryPasswordField v-model="temporaryPassword" />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="submitting" @click="submit">
          Redefinir
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
