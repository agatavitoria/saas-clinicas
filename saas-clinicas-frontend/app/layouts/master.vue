<script setup lang="ts">
import { useDisplay } from 'vuetify'

const { admin, logout } = usePlatformAuth()
const { mdAndUp } = useDisplay()

const drawer = ref(mdAndUp.value)

watch(mdAndUp, (desktop) => {
  drawer.value = desktop
})

// Sessão perdida: volta para o login do master
watch(admin, (current) => {
  if (!current) navigateTo('/master/login')
})

const NAV_ITEMS = [
  { title: 'Clínicas', icon: 'mdi-domain', to: '/master', exact: true },
  { title: 'Nova clínica', icon: 'mdi-plus-circle-outline', to: '/master/clinicas/nova', exact: true },
  { title: 'Atividades', icon: 'mdi-history', to: '/master/atividades', exact: true },
]
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :permanent="mdAndUp" :temporary="!mdAndUp" color="surface">
      <div class="d-flex align-center ga-3 pa-4">
        <v-icon icon="mdi-shield-crown-outline" color="tertiary" />
        <span class="text-subtitle-1 font-weight-bold">SaaS Clínicas</span>
        <v-chip size="x-small" color="tertiary" variant="flat">Master</v-chip>
      </div>

      <v-list nav density="comfortable" color="tertiary">
        <v-list-item
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :exact="item.exact"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="pill"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat color="tertiary">
      <template #prepend>
        <v-app-bar-nav-icon v-if="!mdAndUp" aria-label="Abrir menu" @click="drawer = !drawer" />
      </template>

      <v-app-bar-title>Administração da plataforma</v-app-bar-title>

      <template #append>
        <v-menu v-if="admin" location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" class="me-2 text-none" aria-label="Menu do usuário">
              <v-avatar color="surface" size="32" class="me-sm-2">
                <span class="text-body-2 text-tertiary">{{ initials(admin.name) }}</span>
              </v-avatar>
              <span class="d-none d-sm-inline">{{ firstName(admin.name) }}</span>
              <v-icon icon="mdi-menu-down" end />
            </v-btn>
          </template>

          <v-card min-width="260">
            <v-card-item :title="admin.name" :subtitle="admin.email" />
            <v-divider />
            <v-list density="compact">
              <v-list-item prepend-icon="mdi-logout" title="Sair" @click="logout" />
            </v-list>
          </v-card>
        </v-menu>
      </template>
    </v-app-bar>

    <v-main class="bg-background">
      <slot />
    </v-main>
  </v-app>
</template>
