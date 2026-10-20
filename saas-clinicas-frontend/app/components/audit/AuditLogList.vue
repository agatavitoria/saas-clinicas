<script setup lang="ts">
import type { AuditLogEntry, AuditLogPage } from '~/types/audit'

const props = defineProps<{
  /** Ex.: /audit-logs, /platform/audit-logs ou /platform/clinics/:id/audit-logs */
  basePath: string
  /** Visão do master: mostra a clínica de cada evento e permite filtrar. */
  clinicOptions?: { value: string, title: string }[]
}>()

const api = useApi()

const PAGE_SIZE = 30

const filters = reactive({
  action: null as string | null,
  tenantId: null as string | null,
  from: '',
  to: '',
})

const items = ref<AuditLogEntry[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

function query(cursor?: string) {
  const params: Record<string, string | number> = { limit: PAGE_SIZE }
  if (filters.action) params.action = filters.action
  if (filters.tenantId) params.tenantId = filters.tenantId
  // Datas do filtro no fuso de quem vê; "até" inclui o dia inteiro
  if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).toISOString()
  if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString()
  if (cursor) params.cursor = cursor
  return params
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const page = await api<AuditLogPage>(props.basePath, { query: query() })
    items.value = page.items
    nextCursor.value = page.nextCursor
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value) return
  loadingMore.value = true
  try {
    const page = await api<AuditLogPage>(props.basePath, { query: query(nextCursor.value) })
    items.value.push(...page.items)
    nextCursor.value = page.nextCursor
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loadingMore.value = false
  }
}

watch(filters, load)
onMounted(load)

defineExpose({ reload: load })

const hasFilters = computed(() =>
  Boolean(filters.action || filters.tenantId || filters.from || filters.to),
)

function clearFilters() {
  Object.assign(filters, { action: null, tenantId: null, from: '', to: '' })
}
</script>

<template>
  <div>
    <v-row density="compact" class="mb-2">
      <v-col cols="12" :md="clinicOptions ? 3 : 4">
        <v-autocomplete
          v-model="filters.action"
          :items="AUDIT_ACTION_OPTIONS"
          label="Tipo de evento"
          prepend-inner-icon="mdi-filter-outline"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col v-if="clinicOptions" cols="12" md="3">
        <v-autocomplete
          v-model="filters.tenantId"
          :items="clinicOptions"
          label="Clínica"
          prepend-inner-icon="mdi-domain"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" :md="clinicOptions ? 2 : 3">
        <v-text-field v-model="filters.from" type="date" label="De" density="compact" hide-details />
      </v-col>
      <v-col cols="6" :md="clinicOptions ? 2 : 3">
        <v-text-field v-model="filters.to" type="date" label="Até" density="compact" hide-details />
      </v-col>
      <v-col cols="12" md="2" class="d-flex align-center">
        <v-btn v-if="hasFilters" variant="text" prepend-icon="mdi-filter-remove-outline" @click="clearFilters">
          Limpar
        </v-btn>
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error">
      <template #append>
        <v-btn variant="text" @click="load">Tentar de novo</v-btn>
      </template>
    </v-alert>

    <v-skeleton-loader v-if="loading && !items.length" type="list-item-avatar-two-line@6" />

    <div v-else-if="!items.length" class="text-center text-medium-emphasis py-12">
      <v-icon icon="mdi-history" size="48" class="mb-2" />
      <p>{{ hasFilters ? 'Nenhum evento com esses filtros.' : 'Nenhum evento registrado ainda.' }}</p>
    </div>

    <v-list v-else lines="two" class="bg-transparent py-0" :class="{ 'opacity-60': loading }">
      <template v-for="(entry, index) in items" :key="entry.id">
        <v-divider v-if="index > 0" inset />
        <v-list-item class="px-0 py-3">
          <template #prepend>
            <v-avatar :color="auditActionInfo(entry.action).color" variant="tonal">
              <v-icon :icon="auditActionInfo(entry.action).icon" />
            </v-avatar>
          </template>

          <div class="text-body-1">
            <template v-for="(part, i) in auditSentence(entry)" :key="i">
              <strong v-if="part.bold">{{ part.text }}</strong>
              <span v-else>{{ part.text }}</span>
            </template>
          </div>

          <div class="d-flex flex-wrap align-center ga-2 text-caption text-medium-emphasis mt-1">
            <span>{{ formatDateTime(entry.occurredAt) }}</span>
            <v-chip
              v-if="clinicOptions && entry.tenantId"
              size="x-small"
              variant="tonal"
              prepend-icon="mdi-domain"
            >
              {{ entry.clinicName ?? 'Clínica removida' }}
            </v-chip>
            <v-chip v-else-if="clinicOptions" size="x-small" variant="tonal" color="tertiary">
              Plataforma
            </v-chip>
            <span v-if="entry.ip">· IP {{ entry.ip }}</span>
          </div>
        </v-list-item>
      </template>
    </v-list>

    <div v-if="nextCursor" class="text-center mt-4">
      <v-btn variant="tonal" :loading="loadingMore" prepend-icon="mdi-chevron-down" @click="loadMore">
        Carregar mais
      </v-btn>
    </div>
  </div>
</template>
