<script setup lang="ts">
import type { ClinicBranding, ClinicDetails } from '~/types/clinic'

definePageMeta({ layout: 'master', middleware: 'platform-auth' })

const route = useRoute()
const api = useApi()
const { clinicUrl } = useAreaUrls()
const clinicId = computed(() => String(route.params.id))
const basePath = computed(() => `/platform/clinics/${clinicId.value}`)

const { data: clinic, status, refresh, error } = await useAsyncData(
  () => `platform:clinic:${clinicId.value}`,
  () => api<ClinicDetails>(basePath.value),
)

useHead({ title: () => `${clinic.value?.name ?? 'Clínica'} · Master` })

const notFound = computed(() => statusOf(error.value) === 404 || statusOf(error.value) === 400)
const tab = ref('overview')

const week = computed(() =>
  WEEKDAYS.map(day => ({
    ...day,
    hours: clinic.value?.businessHours.find(hour => hour.weekday === day.value),
  })),
)

const snackbar = reactive({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') =>
  Object.assign(snackbar, { show: true, text, color })

// Ações com confirmação (status e decisões de exclusão)
type PendingAction = 'toggle' | 'confirm' | 'reject' | 'cancel'
const pending = ref<PendingAction | null>(null)
const running = ref(false)

const DIALOGS = computed(() => {
  const name = clinic.value?.name ?? ''
  const active = clinic.value?.active
  return {
    toggle: {
      title: active ? 'Desativar clínica?' : 'Reativar clínica?',
      text: active
        ? `Toda a equipe de ${name} perderá o acesso imediatamente e as sessões abertas serão encerradas.`
        : `A equipe de ${name} poderá voltar a entrar no sistema.`,
      confirmText: active ? 'Desativar' : 'Reativar',
      color: active ? 'error' : 'success',
    },
    confirm: {
      title: 'Confirmar exclusão?',
      text: `${name} ficará somente para consulta e todos os dados serão excluídos definitivamente em 30 dias. Até lá, você ou o administrador da clínica podem cancelar.`,
      confirmText: 'Confirmar exclusão',
      color: 'error',
    },
    reject: {
      title: 'Recusar pedido de exclusão?',
      text: `O pedido será descartado e ${name} continuará funcionando normalmente.`,
      confirmText: 'Recusar pedido',
      color: 'primary',
    },
    cancel: {
      title: 'Cancelar exclusão agendada?',
      text: `A exclusão será cancelada e ${name} voltará a funcionar normalmente.`,
      confirmText: 'Cancelar exclusão',
      color: 'success',
    },
  } satisfies Record<PendingAction, { title: string, text: string, confirmText: string, color: string }>
})

const SUCCESS: Record<PendingAction, () => string> = {
  toggle: () => (clinic.value?.active ? 'Clínica reativada.' : 'Clínica desativada. A equipe perdeu o acesso.'),
  confirm: () => 'Exclusão confirmada e agendada.',
  reject: () => 'Pedido de exclusão recusado.',
  cancel: () => 'Exclusão cancelada. A clínica voltou a funcionar.',
}

async function runPending() {
  const action = pending.value
  if (!action || !clinic.value) return

  running.value = true
  try {
    clinic.value = action === 'toggle'
      ? await api<ClinicDetails>(`${basePath.value}/status`, {
          method: 'PATCH',
          body: { active: !clinic.value.active },
        })
      : await api<ClinicDetails>(`${basePath.value}/deletion/${action}`, { method: 'POST' })
    notify(SUCCESS[action]())
    pending.value = null
  }
  catch (err) {
    notify(errorMessage(err), 'error')
    await refresh()
  }
  finally {
    running.value = false
  }
}

function onBrandingUpdated(branding: ClinicBranding) {
  if (clinic.value) clinic.value = { ...clinic.value, branding }
}

const exporting = ref(false)
async function exportData() {
  if (!clinic.value) return
  exporting.value = true
  try {
    downloadJson(await api(`${basePath.value}/export`), exportFilename(clinic.value.name))
    notify('Exportação concluída. O arquivo foi baixado.')
  }
  catch (err) {
    notify(errorMessage(err), 'error')
  }
  finally {
    exporting.value = false
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
          <h1 class="text-h4 font-weight-bold d-flex flex-wrap align-center ga-3">
            {{ clinic.name }}
            <v-chip :color="clinic.active ? 'success' : 'default'" variant="tonal">
              {{ clinic.active ? 'Ativa' : 'Inativa' }}
            </v-chip>
          </h1>
          <p class="text-body-1 text-medium-emphasis">
            Criada em {{ formatDate(clinic.createdAt) }}
          </p>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn variant="tonal" prepend-icon="mdi-download" :loading="exporting" @click="exportData">
            Exportar dados
          </v-btn>
          <v-btn
            :color="clinic.active ? 'error' : 'success'"
            variant="tonal"
            :prepend-icon="clinic.active ? 'mdi-domain-off' : 'mdi-domain'"
            @click="pending = 'toggle'"
          >
            {{ clinic.active ? 'Desativar clínica' : 'Reativar clínica' }}
          </v-btn>
        </div>
      </div>

      <v-alert
        v-if="clinic.deletion.status === 'REQUESTED'"
        type="warning"
        variant="tonal"
        prominent
        icon="mdi-delete-clock-outline"
        title="A clínica pediu a exclusão dos dados"
        class="mb-6"
      >
        <p>Pedido feito em {{ formatDate(clinic.deletion.requestedAt!) }}.</p>
        <p v-if="clinic.deletion.reason" class="mt-1"><strong>Motivo:</strong> {{ clinic.deletion.reason }}</p>
        <p class="mt-1 text-body-2">
          Ao confirmar, a clínica fica somente para consulta e os dados são excluídos definitivamente em 30 dias.
        </p>
        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-btn color="error" variant="flat" @click="pending = 'confirm'">Confirmar exclusão</v-btn>
          <v-btn variant="text" @click="pending = 'reject'">Recusar</v-btn>
        </div>
      </v-alert>

      <v-alert
        v-else-if="clinic.deletion.status === 'SCHEDULED'"
        type="error"
        variant="tonal"
        prominent
        icon="mdi-delete-alert-outline"
        title="Exclusão agendada"
        class="mb-6"
      >
        Todos os dados serão excluídos definitivamente em
        <strong>{{ formatDate(clinic.deletion.scheduledFor!) }}</strong>. Até lá, a equipe acessa
        somente para consulta, e o administrador da clínica também pode cancelar.
        <template #append>
          <v-btn variant="text" @click="pending = 'cancel'">Cancelar exclusão</v-btn>
        </template>
      </v-alert>

      <v-alert
        v-else-if="!clinic.active"
        type="warning"
        variant="tonal"
        class="mb-6"
        text="Clínica inativa: ninguém da equipe consegue entrar até que ela seja reativada."
      />

      <v-card elevation="1">
        <v-tabs v-model="tab" color="tertiary">
          <v-tab value="overview" prepend-icon="mdi-information-outline">Visão geral</v-tab>
          <v-tab value="users" prepend-icon="mdi-account-group-outline">Usuários</v-tab>
          <v-tab value="branding" prepend-icon="mdi-palette-outline">Personalização</v-tab>
          <v-tab value="activity" prepend-icon="mdi-history">Atividades</v-tab>
        </v-tabs>
        <v-divider />

        <v-tabs-window v-model="tab">
          <v-tabs-window-item value="overview">
            <v-row class="pa-2">
              <v-col cols="12" md="6">
                <v-card-item prepend-icon="mdi-card-account-details-outline" title="Contato" />
                <v-list density="compact" class="pt-0">
                  <v-list-item
                    prepend-icon="mdi-web"
                    :title="clinicUrl(clinic.slug)"
                    subtitle="Endereço de acesso da equipe"
                    :href="`${clinicUrl(clinic.slug)}/login`"
                    target="_blank"
                    rel="noopener"
                    append-icon="mdi-open-in-new"
                  />
                  <v-list-item prepend-icon="mdi-email-outline" :title="clinic.email" />
                  <v-list-item prepend-icon="mdi-phone-outline" :title="formatPhone(clinic.phone)" />
                  <v-list-item v-if="clinic.document" prepend-icon="mdi-file-document-outline" :title="formatTaxId(clinic.document)" />
                </v-list>
              </v-col>
              <v-col cols="12" md="6">
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
              </v-col>
            </v-row>
          </v-tabs-window-item>

          <v-tabs-window-item value="users" class="pa-4">
            <UsersTable :base-path="`${basePath}/users`" />
          </v-tabs-window-item>

          <v-tabs-window-item value="branding" class="pa-4">
            <ClinicNameForm
              :name="clinic.name"
              :path="basePath"
              @update:clinic="(updated: ClinicDetails) => (clinic = updated)"
              @notify="notify"
            />
            <v-divider class="my-6" />
            <BrandingEditor
              :branding="clinic.branding"
              :base-path="basePath"
              @update:branding="onBrandingUpdated"
              @notify="notify"
            />
          </v-tabs-window-item>

          <v-tabs-window-item value="activity" class="pa-4">
            <AuditLogList :base-path="`${basePath}/audit-logs`" />
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card>

      <ConfirmDialog
        v-if="pending"
        :model-value="!!pending"
        :title="DIALOGS[pending].title"
        :text="DIALOGS[pending].text"
        :confirm-text="DIALOGS[pending].confirmText"
        :color="DIALOGS[pending].color"
        :loading="running"
        @update:model-value="(open: boolean) => { if (!open) pending = null }"
        @confirm="runPending"
      />
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
