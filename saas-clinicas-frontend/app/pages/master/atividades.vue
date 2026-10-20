<script setup lang="ts">
import type { ClinicSummary } from '~/types/clinic'

definePageMeta({ layout: 'master', middleware: 'platform-auth' })
useHead({ title: 'Atividades · Master' })

const api = useApi()

const { data: clinics } = await useAsyncData(
  'platform:clinics',
  () => api<ClinicSummary[]>('/platform/clinics'),
  { default: () => [] },
)

const clinicOptions = computed(() =>
  clinics.value.map(clinic => ({ value: clinic.id, title: clinic.name })),
)
</script>

<template>
  <v-container class="py-6" max-width="1100">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Atividades</h1>
      <p class="text-body-1 text-medium-emphasis">
        Histórico de toda a plataforma: ações nas clínicas e da administração.
      </p>
    </div>

    <v-card elevation="1" class="pa-4">
      <AuditLogList base-path="/platform/audit-logs" :clinic-options="clinicOptions" />
    </v-card>
  </v-container>
</template>
