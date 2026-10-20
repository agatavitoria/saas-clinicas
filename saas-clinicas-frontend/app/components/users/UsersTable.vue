<script setup lang="ts">
import type { TeamMember } from '~/types/auth'

const props = defineProps<{
  /** Ex.: /users ou /platform/clinics/:id/users */
  basePath: string
  /** Quem está logado (não pode desativar a si mesmo). */
  currentUserId?: string
}>()

const emit = defineEmits<{ changed: [] }>()

const api = useApi()

const { data: users, status, refresh } = await useAsyncData(
  `users:${props.basePath}`,
  () => api<TeamMember[]>(props.basePath),
  { default: () => [] },
)

const search = ref('')
const showInactive = ref(false)

const visibleUsers = computed(() =>
  users.value.filter(user => showInactive.value || user.active),
)
const inactiveCount = computed(() => users.value.filter(user => !user.active).length)

const HEADERS = [
  { title: 'Usuário', key: 'name' },
  { title: 'Papel', key: 'role', width: 160 },
  { title: 'Status', key: 'active', width: 200 },
  { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 64 },
]

// Diálogos
const creating = ref(false)
const resetting = ref(false)
const selected = ref<TeamMember | null>(null)
const statusDialog = ref(false)
const changingStatus = ref(false)
const credentials = ref<{ name: string, email: string, password: string, reason: string } | null>(null)
const snackbar = reactive({ show: false, text: '', color: 'success' })

function notify(text: string, color = 'success') {
  Object.assign(snackbar, { show: true, text, color })
}

async function afterChange() {
  await refresh()
  emit('changed')
}

function onCreated(user: TeamMember, password: string) {
  credentials.value = { name: user.name, email: user.email, password, reason: 'Usuário criado' }
  afterChange()
}

function onReset(user: TeamMember, password: string) {
  credentials.value = { name: user.name, email: user.email, password, reason: 'Senha redefinida' }
  afterChange()
}

function askStatusChange(user: TeamMember) {
  selected.value = user
  statusDialog.value = true
}

function askReset(user: TeamMember) {
  selected.value = user
  resetting.value = true
}

async function confirmStatusChange() {
  const user = selected.value
  if (!user) return

  changingStatus.value = true
  try {
    await api(`${props.basePath}/${user.id}/status`, {
      method: 'PATCH',
      body: { active: !user.active },
    })
    notify(user.active ? `${user.name} foi desativado(a).` : `${user.name} foi reativado(a).`)
    statusDialog.value = false
    await afterChange()
  }
  catch (error) {
    notify(errorMessage(error), 'error')
  }
  finally {
    changingStatus.value = false
  }
}

async function copyCredentials() {
  if (!credentials.value) return
  const { email, password } = credentials.value
  await navigator.clipboard.writeText(`E-mail: ${email}\nSenha provisória: ${password}`)
  notify('Dados de acesso copiados.')
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-text-field
        v-model="search"
        placeholder="Buscar por nome ou e-mail"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        hide-details
        clearable
        class="flex-grow-1"
        style="min-width: 220px"
      />
      <v-switch
        v-model="showInactive"
        :label="`Mostrar inativos (${inactiveCount})`"
        density="compact"
        class="flex-grow-0"
      />
      <v-btn color="primary" variant="flat" prepend-icon="mdi-account-plus-outline" @click="creating = true">
        Novo usuário
      </v-btn>
    </div>

    <v-alert
      v-if="status === 'error'"
      type="error"
      variant="tonal"
      text="Não foi possível carregar a equipe."
    >
      <template #append>
        <v-btn variant="text" @click="() => refresh()">Tentar de novo</v-btn>
      </template>
    </v-alert>

    <v-data-table
      v-else
      :headers="HEADERS"
      :items="visibleUsers"
      :search="search"
      :loading="status === 'pending'"
      :filter-keys="['name', 'email']"
      items-per-page="10"
      no-data-text="Nenhum usuário encontrado"
      loading-text="Carregando equipe..."
      class="bg-transparent"
    >
      <template #[`item.name`]="{ item }">
        <div class="d-flex align-center ga-3 py-2" :class="{ 'text-disabled': !item.active }">
          <v-avatar :color="ROLE_COLORS[item.role]" variant="tonal" size="36">
            <span class="text-body-2">{{ initials(item.name) }}</span>
          </v-avatar>
          <div>
            <div class="font-weight-medium">
              {{ item.name }}
              <span v-if="item.id === currentUserId" class="text-caption text-medium-emphasis">(você)</span>
            </div>
            <div class="text-caption text-medium-emphasis">{{ item.email }}</div>
          </div>
        </div>
      </template>

      <template #[`item.role`]="{ item }">
        <v-chip size="small" variant="tonal" :color="ROLE_COLORS[item.role]">
          {{ ROLE_LABELS[item.role] }}
        </v-chip>
      </template>

      <template #[`item.active`]="{ item }">
        <div class="d-flex flex-wrap ga-1">
          <v-chip
            size="small"
            :color="item.active ? 'success' : 'default'"
            :prepend-icon="item.active ? 'mdi-check-circle-outline' : 'mdi-cancel'"
            variant="tonal"
          >
            {{ item.active ? 'Ativo' : 'Inativo' }}
          </v-chip>
          <v-chip v-if="item.active && item.mustChangePassword" size="small" variant="outlined" color="warning">
            Senha provisória
          </v-chip>
        </div>
      </template>

      <template #[`item.actions`]="{ item }">
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon="mdi-dots-vertical" variant="text" size="small" :aria-label="`Ações para ${item.name}`" />
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-lock-reset"
              title="Redefinir senha"
              :disabled="!item.active"
              @click="askReset(item)"
            />
            <v-list-item
              :prepend-icon="item.active ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
              :title="item.active ? 'Desativar' : 'Reativar'"
              :base-color="item.active ? 'error' : undefined"
              :disabled="item.id === currentUserId"
              @click="askStatusChange(item)"
            />
          </v-list>
        </v-menu>
      </template>
    </v-data-table>

    <UsersUserFormDialog v-model="creating" :base-path="basePath" @created="onCreated" />
    <UsersResetPasswordDialog v-model="resetting" :base-path="basePath" :user="selected" @reset="onReset" />

    <ConfirmDialog
      v-model="statusDialog"
      :title="selected?.active ? 'Desativar usuário?' : 'Reativar usuário?'"
      :text="selected?.active
        ? `${selected?.name} perderá o acesso imediatamente e as sessões abertas serão encerradas. Você pode reativar depois.`
        : `${selected?.name} poderá voltar a entrar no sistema.`"
      :confirm-text="selected?.active ? 'Desativar' : 'Reativar'"
      :color="selected?.active ? 'error' : 'primary'"
      :loading="changingStatus"
      @confirm="confirmStatusChange"
    />

    <v-dialog :model-value="!!credentials" max-width="480" @update:model-value="credentials = null">
      <v-card v-if="credentials" :title="credentials.reason" prepend-icon="mdi-check-circle" >
        <v-card-text>
          <p class="mb-4">Repasse estes dados para <strong>{{ credentials.name }}</strong>. A senha provisória precisa ser trocada no primeiro acesso.</p>
          <v-sheet color="surface-variant" rounded="lg" class="pa-4 font-monospace">
            <div>E-mail: {{ credentials.email }}</div>
            <div>Senha provisória: <strong>{{ credentials.password }}</strong></div>
          </v-sheet>
        </v-card-text>
        <v-card-actions>
          <v-btn prepend-icon="mdi-content-copy" variant="text" @click="copyCredentials">Copiar</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="credentials = null">Concluir</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>
