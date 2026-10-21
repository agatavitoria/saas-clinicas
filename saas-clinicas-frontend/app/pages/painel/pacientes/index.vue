<script setup lang="ts">
import type { PatientDetails, PatientPage } from '~/types/patient'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Pacientes · SaaS Clínicas' })

const api = useApi()
const { canManagePatients } = useAuth()
const { readOnly } = useClinic()

const HEADERS = [
  { title: 'Paciente', key: 'name' },
  { title: 'CPF', key: 'cpf', sortable: false, width: 160 },
  { title: 'Idade', key: 'birthDate', sortable: false, width: 110 },
  { title: 'Telefone', key: 'phone', sortable: false, width: 170 },
  { title: 'Status', key: 'active', sortable: false, width: 110 },
]
const STATUS_OPTIONS = [
  { value: 'active', title: 'Ativos' },
  { value: 'inactive', title: 'Inativos' },
  { value: 'all', title: 'Todos' },
]

const search = ref('')
const debouncedSearch = ref('')
const status = ref<'active' | 'inactive' | 'all'>('active')
const page = ref(1)
const pageSize = ref(20)
const data = ref<PatientPage>({ items: [], total: 0, page: 1, pageSize: 20 })
const loading = ref(false)
const error = ref('')
const creating = ref(false)

let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    debouncedSearch.value = value?.trim() ?? ''
    page.value = 1
  }, 300)
})
watch(status, () => (page.value = 1))

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await api<PatientPage>('/patients', {
      query: {
        search: debouncedSearch.value || undefined,
        status: status.value,
        page: page.value,
        pageSize: pageSize.value,
      },
    })
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

watch([debouncedSearch, status, page, pageSize], load)
onMounted(load)

function onCreated(patient: PatientDetails) {
  navigateTo(`/painel/pacientes/${patient.id}`)
}

function onOptions(options: { page: number, itemsPerPage: number }) {
  page.value = options.page
  pageSize.value = options.itemsPerPage
}
</script>

<template>
  <v-container class="py-6" max-width="1200">
    <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Pacientes</h1>
        <p class="text-body-1 text-medium-emphasis">
          {{ data.total }} {{ data.total === 1 ? 'paciente' : 'pacientes' }}
          {{ status === 'inactive' ? 'inativos' : status === 'all' ? 'no total' : 'ativos' }}
        </p>
      </div>
      <v-btn
        v-if="canManagePatients && !readOnly"
        color="primary"
        variant="flat"
        size="large"
        prepend-icon="mdi-account-plus-outline"
        @click="creating = true"
      >
        Novo paciente
      </v-btn>
    </div>

    <v-card elevation="1" class="pa-4">
      <div class="d-flex flex-wrap ga-3 mb-4">
        <v-text-field
          v-model="search"
          placeholder="Buscar por nome ou CPF"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          hide-details
          clearable
          class="flex-grow-1"
          style="min-width: 240px"
        />
        <v-select
          v-model="status"
          :items="STATUS_OPTIONS"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 160px"
        />
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error">
        <template #append>
          <v-btn variant="text" @click="load">Tentar de novo</v-btn>
        </template>
      </v-alert>

      <v-data-table-server
        :headers="HEADERS"
        :items="data.items"
        :items-length="data.total"
        :page="page"
        :items-per-page="pageSize"
        :items-per-page-options="[10, 20, 50, 100]"
        :loading="loading"
        :sort-by="[]"
        hover
        no-data-text="Nenhum paciente encontrado"
        loading-text="Carregando pacientes..."
        class="bg-transparent"
        @update:options="onOptions"
        @click:row="(_: unknown, { item }: { item: { id: string } }) => navigateTo(`/painel/pacientes/${item.id}`)"
      >
        <template #[`item.name`]="{ item }">
          <div class="py-2 cursor-pointer">
            <div class="font-weight-medium">{{ displayName(item) }}</div>
            <div v-if="item.socialName" class="text-caption text-medium-emphasis">{{ item.name }}</div>
          </div>
        </template>
        <template #[`item.cpf`]="{ item }">{{ formatCpf(item.cpf) }}</template>
        <template #[`item.birthDate`]="{ item }">{{ ageLabel(item.birthDate) }}</template>
        <template #[`item.phone`]="{ item }">{{ item.phone ? formatPhone(item.phone) : '—' }}</template>
        <template #[`item.active`]="{ item }">
          <v-chip size="small" variant="tonal" :color="item.active ? 'success' : 'default'">
            {{ item.active ? 'Ativo' : 'Inativo' }}
          </v-chip>
        </template>
      </v-data-table-server>
    </v-card>

    <PatientsPatientFormDialog v-model="creating" @saved="onCreated" />
  </v-container>
</template>
