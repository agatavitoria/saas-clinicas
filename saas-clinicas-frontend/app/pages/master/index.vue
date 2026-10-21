<script setup lang="ts">
import type { ClinicSummary } from '~/types/clinic'

definePageMeta({ layout: 'master', middleware: 'platform-auth' })
useHead({ title: 'Clínicas · Master' })

const api = useApi()

const { data: clinics, status, refresh } = await useAsyncData(
  'platform:clinics',
  () => api<ClinicSummary[]>('/platform/clinics'),
  { default: () => [] },
)

const search = ref('')
const activeCount = computed(() => clinics.value.filter(clinic => clinic.active).length)
const pendingDeletions = computed(
  () => clinics.value.filter(clinic => clinic.deletion.status === 'REQUESTED').length,
)

const HEADERS = [
  { title: 'Clínica', key: 'name' },
  { title: 'Telefone', key: 'phone', width: 170 },
  { title: 'Usuários', key: 'usersCount', align: 'center' as const, width: 120 },
  { title: 'Pacientes', key: 'patientsCount', align: 'center' as const, width: 120 },
  { title: 'Status', key: 'active', width: 220 },
  { title: 'Criada em', key: 'createdAt', width: 140 },
]

</script>

<template>
  <v-container class="py-6" max-width="1200">
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Clínicas</h1>
        <p class="text-body-1 text-medium-emphasis">
          {{ clinics.length }} {{ clinics.length === 1 ? 'clínica' : 'clínicas' }} ·
          {{ activeCount }} {{ activeCount === 1 ? 'ativa' : 'ativas' }}
        </p>
      </div>
      <v-btn color="tertiary" variant="flat" size="large" prepend-icon="mdi-plus" to="/master/clinicas/nova">
        Nova clínica
      </v-btn>
    </div>

    <v-alert
      v-if="pendingDeletions"
      type="warning"
      variant="tonal"
      icon="mdi-delete-clock-outline"
      class="mb-4"
      :text="pendingDeletions === 1
        ? '1 clínica pediu a exclusão dos dados e aguarda sua decisão.'
        : `${pendingDeletions} clínicas pediram a exclusão dos dados e aguardam sua decisão.`"
    />

    <v-card elevation="1" class="pa-4">
      <v-text-field
        v-model="search"
        placeholder="Buscar por nome ou e-mail"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        hide-details
        clearable
        class="mb-4"
      />

      <v-alert v-if="status === 'error'" type="error" variant="tonal" text="Não foi possível carregar as clínicas.">
        <template #append>
          <v-btn variant="text" @click="() => refresh()">Tentar de novo</v-btn>
        </template>
      </v-alert>

      <v-data-table
        v-else
        :headers="HEADERS"
        :items="clinics"
        :search="search"
        :filter-keys="['name', 'email']"
        :loading="status === 'pending'"
        items-per-page="15"
        hover
        no-data-text="Nenhuma clínica cadastrada ainda"
        loading-text="Carregando clínicas..."
        class="bg-transparent"
        @click:row="(_: unknown, { item }: { item: ClinicSummary }) => navigateTo(`/master/clinicas/${item.id}`)"
      >
        <template #[`item.name`]="{ item }">
          <div class="py-2 cursor-pointer">
            <div class="font-weight-medium">{{ item.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.email }}</div>
          </div>
        </template>
        <template #[`item.phone`]="{ item }">{{ formatPhone(item.phone) }}</template>
        <template #[`item.active`]="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip size="small" variant="tonal" :color="item.active ? 'success' : 'default'">
              {{ item.active ? 'Ativa' : 'Inativa' }}
            </v-chip>
            <v-chip v-if="item.deletion.status === 'REQUESTED'" size="small" color="warning" variant="flat">
              Exclusão solicitada
            </v-chip>
            <v-chip v-else-if="item.deletion.status === 'SCHEDULED'" size="small" color="error" variant="flat">
              Exclusão em {{ formatDate(item.deletion.scheduledFor!) }}
            </v-chip>
          </div>
        </template>
        <template #[`item.createdAt`]="{ item }">{{ formatDate(item.createdAt) }}</template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
