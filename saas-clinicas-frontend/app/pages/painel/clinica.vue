<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicDetails } from '~/types/clinic'

definePageMeta({ layout: 'dashboard', middleware: ['auth', 'admin'] })
useHead({ title: 'Clínica · SaaS Clínicas' })

const api = useApi()
const { clinic, refresh, daysUntilDeletion } = useClinic()

const status = ref<'pending' | 'success' | 'error'>('pending')
onMounted(async () => {
  status.value = (await refresh()) ? 'success' : 'error'
})

const snackbar = reactive({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') =>
  Object.assign(snackbar, { show: true, text, color })

// Exportação
const exporting = ref(false)
async function exportData() {
  if (!clinic.value) return
  exporting.value = true
  try {
    const data = await api('/clinics/me/export')
    downloadJson(data, exportFilename(clinic.value.name))
    notify('Exportação concluída. O arquivo foi baixado.')
  }
  catch (error) {
    notify(errorMessage(error), 'error')
  }
  finally {
    exporting.value = false
  }
}

// Pedido de exclusão
const deletionDialog = ref(false)
const deletionForm = ref<VForm>()
const confirmationName = ref('')
const reason = ref('')
const requesting = ref(false)
const cancelling = ref(false)

watch(deletionDialog, (open) => {
  if (open) {
    confirmationName.value = ''
    reason.value = ''
  }
})

async function requestDeletion() {
  const { valid } = (await deletionForm.value?.validate()) ?? { valid: false }
  if (!valid) return

  requesting.value = true
  try {
    clinic.value = await api<ClinicDetails>('/clinics/me/deletion-request', {
      method: 'POST',
      body: { confirmationName: confirmationName.value.trim(), reason: reason.value.trim() || undefined },
    })
    deletionDialog.value = false
    notify('Pedido enviado. A equipe da plataforma vai analisar.')
  }
  catch (error) {
    notify(errorMessage(error), 'error')
  }
  finally {
    requesting.value = false
  }
}

async function cancelRequest() {
  cancelling.value = true
  try {
    clinic.value = await api<ClinicDetails>('/clinics/me/deletion-request', { method: 'DELETE' })
    notify('Exclusão cancelada. A clínica voltou a funcionar normalmente.')
  }
  catch (error) {
    notify(errorMessage(error), 'error')
    await refresh()
  }
  finally {
    cancelling.value = false
  }
}

const week = computed(() =>
  WEEKDAYS.map(day => ({
    ...day,
    hours: clinic.value?.businessHours.find(hour => hour.weekday === day.value),
  })),
)
</script>

<template>
  <v-container class="py-6" max-width="1000">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Clínica</h1>
      <p class="text-body-1 text-medium-emphasis">Dados da clínica e privacidade.</p>
    </div>

    <v-skeleton-loader v-if="status === 'pending' && !clinic" type="article, article" class="rounded-xl" />

    <v-alert v-else-if="!clinic" type="error" variant="tonal" text="Não foi possível carregar a clínica.">
      <template #append>
        <v-btn variant="text" @click="refresh">Tentar de novo</v-btn>
      </template>
    </v-alert>

    <template v-else>
      <v-row>
        <v-col cols="12" md="6">
          <v-card class="h-100" elevation="1">
            <v-card-item prepend-icon="mdi-hospital-building" :title="clinic.name" subtitle="Dados de contato" />
            <v-list density="compact" class="pt-0">
              <v-list-item prepend-icon="mdi-email-outline" :title="clinic.email" />
              <v-list-item prepend-icon="mdi-phone-outline" :title="formatPhone(clinic.phone)" />
              <v-list-item v-if="clinic.document" prepend-icon="mdi-file-document-outline" :title="formatTaxId(clinic.document)" />
            </v-list>
            <v-card-text class="pt-0 text-caption text-medium-emphasis">
              Para alterar esses dados, fale com o suporte da plataforma.
            </v-card-text>
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
          <v-card elevation="1">
            <v-card-item prepend-icon="mdi-shield-account-outline" title="Privacidade e dados" subtitle="Direitos previstos na LGPD" />
            <v-card-text>
              <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">Exportar dados</div>
                  <div class="text-body-2 text-medium-emphasis">
                    Baixe um arquivo com os dados da clínica, a equipe e o histórico de atividades.
                  </div>
                </div>
                <v-btn variant="tonal" prepend-icon="mdi-download" :loading="exporting" @click="exportData">
                  Exportar dados
                </v-btn>
              </div>

              <v-divider class="mb-6" />

              <div class="text-subtitle-1 font-weight-medium mb-1">Excluir a clínica</div>

              <v-alert
                v-if="clinic.deletion.status === 'REQUESTED'"
                type="warning"
                variant="tonal"
                icon="mdi-delete-clock-outline"
                title="Exclusão solicitada"
                class="mt-2"
              >
                Pedido feito em {{ formatDate(clinic.deletion.requestedAt!) }}. A equipe da
                plataforma vai confirmar; depois disso, a clínica fica somente para consulta
                e os dados são excluídos definitivamente em 30 dias.
                <template #append>
                  <v-btn variant="text" :loading="cancelling" @click="cancelRequest">Cancelar pedido</v-btn>
                </template>
              </v-alert>

              <v-alert
                v-else-if="clinic.deletion.status === 'SCHEDULED'"
                type="error"
                variant="tonal"
                icon="mdi-delete-alert-outline"
                :title="daysUntilDeletion === 1 ? 'Falta 1 dia' : `Faltam ${daysUntilDeletion} dias`"
                class="mt-2"
              >
                A exclusão foi confirmada e os dados serão excluídos definitivamente em
                {{ formatDate(clinic.deletion.scheduledFor!) }}. Até lá, o sistema fica somente
                para consulta. Exporte os dados se precisar deles.
                <template #append>
                  <v-btn variant="text" :loading="cancelling" @click="cancelRequest">Cancelar exclusão</v-btn>
                </template>
              </v-alert>

              <div v-else class="d-flex flex-wrap align-center justify-space-between ga-4">
                <div class="text-body-2 text-medium-emphasis" style="max-width: 640px">
                  A exclusão apaga definitivamente a clínica, a equipe e os dados. O histórico de
                  atividades é mantido de forma anônima. Antes de pedir, exporte os dados se
                  precisar deles.
                </div>
                <v-btn color="error" variant="outlined" prepend-icon="mdi-delete-outline" @click="deletionDialog = true">
                  Solicitar exclusão
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog v-model="deletionDialog" max-width="560" :persistent="requesting">
        <v-card title="Solicitar exclusão da clínica" prepend-icon="mdi-delete-alert-outline">
          <v-card-text>
            <ol class="ps-4 mb-4 text-body-2">
              <li>A equipe da plataforma analisa e confirma o pedido.</li>
              <li>Na confirmação, o sistema passa a ser somente para consulta.</li>
              <li>
                Depois de <strong>30 dias</strong>, todos os dados são excluídos definitivamente.
                Até lá, você pode cancelar a exclusão a qualquer momento.
              </li>
            </ol>
            <v-form ref="deletionForm" @submit.prevent="requestDeletion">
              <v-text-field
                v-model="confirmationName"
                :label="`Digite ${clinic.name} para confirmar`"
                autocomplete="off"
                class="mb-2"
                :rules="[
                  formRules.required(),
                  (value: unknown) => String(value ?? '').trim() === clinic!.name || 'O nome não confere',
                ]"
              />
              <v-textarea
                v-model="reason"
                label="Motivo (opcional)"
                rows="2"
                auto-grow
                counter="500"
                variant="outlined"
                :rules="[(value: unknown) => String(value ?? '').length <= 500 || 'Máximo de 500 caracteres']"
              />
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="requesting" @click="deletionDialog = false">Voltar</v-btn>
            <v-btn color="error" variant="flat" :loading="requesting" @click="requestDeletion">
              Solicitar exclusão
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>
