<script setup lang="ts">
import { useDisplay } from 'vuetify'

const { user, isAdmin, logout } = useAuth()
const { refresh: refreshClinic } = useClinic()

// Situação da clínica (ex.: exclusão agendada) para o aviso no topo
onMounted(refreshClinic)
const { mdAndUp } = useDisplay()

const drawer = ref(mdAndUp.value)
const loggingOut = ref(false)

watch(mdAndUp, (desktop) => {
  drawer.value = desktop
})

// Sessão perdida (ex.: refresh token expirado): volta para o login
watch(user, (current) => {
  if (!current) navigateTo('/login')
})

const navItems = computed(() => [
  { title: 'Painel', icon: 'mdi-view-dashboard-outline', to: '/painel' },
  { title: 'Pacientes', icon: 'mdi-account-heart-outline', to: '/painel/pacientes' },
  ...(isAdmin.value
    ? [
        { title: 'Equipe', icon: 'mdi-account-group-outline', to: '/painel/equipe' },
        { title: 'Atividades', icon: 'mdi-history', to: '/painel/atividades' },
        { title: 'Clínica', icon: 'mdi-cog-outline', to: '/painel/clinica' },
      ]
    : []),
  { title: 'Agenda', icon: 'mdi-calendar-month-outline', soon: true },

  { title: 'Profissionais', icon: 'mdi-stethoscope', soon: true },
])

const route = useRoute()
const pageTitle = computed(() =>
  navItems.value.find(item => item.to === route.path)?.title
  ?? (route.path.startsWith('/painel/pacientes') ? 'Pacientes' : 'Painel'),
)

async function onLogout() {
  loggingOut.value = true
  try {
    await logout()
  }
  finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :permanent="mdAndUp" :temporary="!mdAndUp">
      <div class="d-flex align-center ga-3 pa-4">
        <v-icon icon="mdi-hospital-building" color="primary" />
        <span class="text-subtitle-1 font-weight-bold">SaaS Clínicas</span>
      </div>

      <v-list nav density="comfortable" color="primary">
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :disabled="item.soon"
          rounded="pill"
          :exact="item.to === '/painel'"
        >
          <template v-if="item.soon" #append>
            <v-chip size="x-small" variant="tonal">Em breve</v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat border="b" color="surface">
      <template #prepend>
        <v-app-bar-nav-icon
          v-if="!mdAndUp"
          aria-label="Abrir menu"
          @click="drawer = !drawer"
        />
      </template>

      <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>

      <template #append>
        <v-menu v-if="user" location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" class="me-2 text-none" aria-label="Menu do usuário">
              <v-avatar color="primary" size="32" class="me-sm-2">
                <span class="text-body-2">{{ initials(user.name) }}</span>
              </v-avatar>
              <span class="d-none d-sm-inline">{{ firstName(user.name) }}</span>
              <v-icon icon="mdi-menu-down" end />
            </v-btn>
          </template>

          <v-card min-width="260">
            <v-card-item :title="user.name" :subtitle="user.email">
              <template #prepend>
                <v-avatar color="primary">
                  <span>{{ initials(user.name) }}</span>
                </v-avatar>
              </template>
            </v-card-item>
            <v-card-text class="pt-0">
              <v-chip size="small" variant="tonal" :color="ROLE_COLORS[user.role]">
                {{ ROLE_LABELS[user.role] }}
              </v-chip>
            </v-card-text>
            <v-divider />
            <v-list density="compact">
              <v-list-item prepend-icon="mdi-lock-reset" title="Trocar senha" to="/trocar-senha" />
              <v-list-item
                prepend-icon="mdi-logout"
                title="Sair"
                :disabled="loggingOut"
                @click="onLogout"
              />
            </v-list>
          </v-card>
        </v-menu>
      </template>
    </v-app-bar>

    <v-main class="bg-background">
      <DeletionCountdownBanner />
      <slot />
    </v-main>
  </v-app>
</template>
