<script setup lang="ts">
import type { ClinicDetails } from '~/types/clinic'

definePageMeta({ layout: 'master', middleware: 'platform-auth' })

const route = useRoute()
const api = useApi()
const clinicId = computed(() => String(route.params.id))

const { data: clinic, status, refresh, error } = await useAsyncData(
  () => `platform:clinic:${clinicId.value}`,
  () => api<ClinicDetails>(`/platform/clinics/${clinicId.value}`),
)

useHead({ title: () => `${clinic.value?.name ?? 'Clínica'} · Master` })

const notFound = computed(() => statusOf(error.value) === 404 || statusOf(error.value) === 400)

const week = computed(() =>
  WEEKDAYS.map(day => ({
    ...day,
    hours: clinic.value?.businessHours.find(hour => hour.weekday === day.value),
  })),
)

const statusDialog = ref(false)
const changingStatus = ref(false)
const snackbar = reactive({ show: false, text: '', color: 'success' })

async function toggleStatus() {
  if (!clinic.value) return
  changingStatus.value = true
  try {
    const active = !clinic.value.active
    clinic.value = await api<ClinicDetails>(`/platform/clinics/${clinicId.value}/status`, {
      method: 'PATCH',
      body: { active },
    })
    Object.assign(snackbar, {
      show: true,
      color: 'success',
      text: active ? 'Clínica reativada.' : 'Clínica desativada. A equipe perdeu o acesso.',
    })
    statusDialog.value = false
  }
  catch (err) {
    Object.assign(snackbar, { show: true, color: 'error', text: errorMessage(err) })
  }
  finally {
    changingStatus.value = false
  }
}
</script>

<template>
  <v-container class="py-6" max-width="1200">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/master" class="mb-4 ms-n3">
      Clínicas
    </v-btn>

    <v-alert v-if="notFound" type="warning" variant="tonal" title="Clínica não encontrada" />

    <v-alert v-else-if="status === 'error'" type="error" variant="tonal" text="Não foi possível carregar a clínica.">
      <template #append>
        <v-btn variant="text" @click="() => refresh()">Tentar de novo</v-btn>
      </template>
    </v-alert>

    <v-skeleton-loader v-else-if="!clinic" type="article, table" class="rounded-xl" />

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold d-flex align-center ga-3">
            {{ clinic.name }}
            <v-chip :color="clinic.active ? 'success' : 'default'" variant="tonal">
              {{ clinic.active ? 'Ativa' : 'Inativa' }}
            </v-chip>
          </h1>
          <p class="text-body-1 text-medium-emphasis">
            Criada em {{ new Date(clinic.createdAt).toLocaleDateString('pt-BR') }}
          </p>
        </div>
        <v-btn
          :color="clinic.active ? 'error' : 'success'"
          variant="tonal"
          :prepend-icon="clinic.active ? 'mdi-domain-off' : 'mdi-domain'"
          @click="statusDialog = true"
        >
          {{ clinic.active ? 'Desativar clínica' : 'Reativar clínica' }}
        </v-btn>
      </div>

      <v-alert
        v-if="!clinic.active"
        type="warning"
        variant="tonal"
        class="mb-6"
        text="Clínica inativa: ninguém da equipe consegue entrar até que ela seja reativada."
      />

      <v-row>
        <v-col cols="12" md="6">
          <v-card class="h-100" elevation="1">
            <v-card-item prepend-icon="mdi-card-account-details-outline" title="Contato" />
            <v-list density="compact" class="pt-0">
              <v-list-item prepend-icon="mdi-email-outline" :title="clinic.email" />
              <v-list-item prepend-icon="mdi-phone-outline" :title="formatPhone(clinic.phone)" />
              <v-list-item
                v-if="clinic.document"
                prepend-icon="mdi-file-document-outline"
                :title="formatTaxId(clinic.document)"
              />
            </v-list>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card class="h-100" elevation="1">
            <v-card-item prepend-icon="mdi-clock-outline" title="Horário de funcionamento" />
            <v-list density="compact" class="pt-0">
              <v-list-item v-for="day in week" :key="day.value">
                <div class="d-flex justify-space-between">
                  <span>{{ day.label }}</span>
                  <span :class="day.hours ? '' : 'text-medium-emphasis'">
                    {{ day.hours ? `${day.hours.opensAt} – ${day.hours.closesAt}` : 'Fechado' }}
                  </span>
                </div>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>

        <v-col cols="12">
          <v-card elevation="1" class="pa-4">
            <v-card-item prepend-icon="mdi-account-group-outline" title="Usuários" class="px-0 pt-0" />
            <UsersTable :base-path="`/platform/clinics/${clinic.id}/users`" />
          </v-card>
        </v-col>
      </v-row>

      <ConfirmDialog
        v-model="statusDialog"
        :title="clinic.active ? 'Desativar clínica?' : 'Reativar clínica?'"
        :text="clinic.active
          ? `Toda a equipe de ${clinic.name} perderá o acesso imediatamente e as sessões abertas serão encerradas.`
          : `A equipe de ${clinic.name} poderá voltar a entrar no sistema.`"
        :confirm-text="clinic.active ? 'Desativar' : 'Reativar'"
        :color="clinic.active ? 'error' : 'success'"
        :loading="changingStatus"
        @confirm="toggleStatus"
      />
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
