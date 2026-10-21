<script setup lang="ts">
import type { TeamMember, UserRole } from '~/types/auth'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  basePath: string
  user: TeamMember | null
  /** Quem está logado: não pode tirar o próprio papel de admin. */
  currentUserId?: string
}>()

const emit = defineEmits<{ saved: [user: TeamMember] }>()

const api = useApi()
const roles = ref<UserRole[]>([])
const submitting = ref(false)
const error = ref('')

const isSelf = computed(() => props.user?.id === props.currentUserId)

const DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Gerencia a equipe, a clínica, o histórico e a privacidade',
  PROFESSIONAL: 'Atende pacientes e registra no prontuário',
  RECEPTION: 'Cadastra pacientes e organiza a agenda',
}

watch(open, (isOpen) => {
  if (!isOpen || !props.user) return
  roles.value = [...props.user.roles]
  error.value = ''
})

function toggle(role: UserRole, checked: boolean | null) {
  roles.value = checked ? [...roles.value, role] : roles.value.filter(item => item !== role)
}

async function submit() {
  if (!props.user || !roles.value.length) return
  submitting.value = true
  error.value = ''
  try {
    const user = await api<TeamMember>(`${props.basePath}/${props.user.id}/roles`, {
      method: 'PATCH',
      body: { roles: roles.value },
    })
    emit('saved', user)
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
  <v-dialog v-model="open" max-width="480" :persistent="submitting">
    <v-card title="Editar papéis" :subtitle="user?.name" prepend-icon="mdi-badge-account-outline">
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" :text="error" />
        <p class="text-body-2 text-medium-emphasis mb-2">
          Uma pessoa pode ter mais de um papel. As permissões somam.
        </p>
        <v-checkbox
          v-for="option in ROLE_OPTIONS"
          :key="option.value"
          :model-value="roles.includes(option.value)"
          :label="option.title"
          :hint="isSelf && option.value === 'ADMIN' ? 'Você não pode tirar o seu próprio papel de administrador' : DESCRIPTIONS[option.value]"
          persistent-hint
          :disabled="isSelf && option.value === 'ADMIN' && roles.includes('ADMIN')"
          color="primary"
          class="mb-2"
          @update:model-value="checked => toggle(option.value, checked)"
        />
        <p v-if="!roles.length" class="text-error text-caption">Escolha pelo menos um papel.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="submitting" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="submitting" :disabled="!roles.length" @click="submit">
          Salvar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
