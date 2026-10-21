<script setup lang="ts">
import type { PatientDetails, PatientRecord } from '~/types/patient'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const api = useApi()
const { user, isAdmin, canManagePatients, canWriteRecords } = useAuth()
const { readOnly } = useClinic()

const patientId = computed(() => String(route.params.id))

const patient = ref<PatientDetails | null>(null)
const records = ref<PatientRecord[]>([])
const loading = ref(true)
const loadingRecords = ref(false)
const notFound = ref(false)
const error = ref('')
const professionalFilter = ref<string | null>(null)

useHead({ title: () => `${patient.value ? displayName(patient.value) : 'Paciente'} · SaaS Clínicas` })

async function loadPatient() {
  loading.value = true
  error.value = ''
  try {
    patient.value = await api<PatientDetails>(`/patients/${patientId.value}`)
  }
  catch (err) {
    if (statusOf(err) === 404 || statusOf(err) === 400) notFound.value = true
    else error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    records.value = await api<PatientRecord[]>(`/patients/${patientId.value}/records`, {
      query: { professionalId: professionalFilter.value ?? undefined },
    })
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loadingRecords.value = false
  }
}

onMounted(async () => {
  await loadPatient()
  if (patient.value) await loadRecords()
})
watch(professionalFilter, loadRecords)

/** Profissionais que já atenderam (para o filtro). */
const professionals = ref<{ value: string, title: string }[]>([])
watch(records, (list) => {
  if (professionalFilter.value) return
  const seen = new Map(list.map(record => [record.professional.id, record.professional.name]))
  professionals.value = [...seen].map(([value, title]) => ({ value, title }))
})

const canEdit = computed(() => canManagePatients.value && !readOnly.value)
const canRecord = computed(() => canWriteRecords.value && !readOnly.value && patient.value?.active)
const canAmend = (record: PatientRecord) =>
  canWriteRecords.value && !readOnly.value && (record.professional.id === user.value?.id || isAdmin.value)

// Diálogos
const editing = ref(false)
const recording = ref(false)
const amending = ref<PatientRecord | null>(null)
const statusDialog = ref(false)
const changingStatus = ref(false)
const snackbar = reactive({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => Object.assign(snackbar, { show: true, text, color })

function openAmendment(record: PatientRecord) {
  amending.value = record
  recording.value = true
}

function openNewRecord() {
  amending.value = null
  recording.value = true
}

async function toggleStatus() {
  if (!patient.value) return
  changingStatus.value = true
  try {
    const active = !patient.value.active
    patient.value = await api<PatientDetails>(`/patients/${patient.value.id}/status`, {
      method: 'PATCH',
      body: { active },
    })
    notify(active ? 'Paciente reativado.' : 'Paciente inativado.')
    statusDialog.value = false
  }
  catch (err) {
    notify(errorMessage(err), 'error')
  }
  finally {
    changingStatus.value = false
  }
}

</script>

<template>
  <v-container class="py-6" max-width="1100">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/painel/pacientes" class="mb-4 ms-n3">
      Pacientes
    </v-btn>

    <v-alert v-if="notFound" type="warning" variant="tonal" title="Paciente não encontrado" />
    <v-alert v-else-if="error && !patient" type="error" variant="tonal" :text="error">
      <template #append>
        <v-btn variant="text" @click="loadPatient">Tentar de novo</v-btn>
      </template>
    </v-alert>
    <v-skeleton-loader v-else-if="loading || !patient" type="article, article" class="rounded-xl" />

    <template v-else>
      <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
        <div class="d-flex align-center ga-4">
          <v-avatar color="primary" variant="tonal" size="56">
            <span class="text-h6">{{ initials(displayName(patient)) }}</span>
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold d-flex flex-wrap align-center ga-3">
              {{ displayName(patient) }}
              <v-chip v-if="!patient.active" variant="tonal">Inativo</v-chip>
            </h1>
            <p class="text-body-1 text-medium-emphasis">
              {{ ageLabel(patient.birthDate) }} · CPF {{ formatCpf(patient.cpf) }}
            </p>
          </div>
        </div>
        <div v-if="canEdit" class="d-flex flex-wrap ga-2">
          <v-btn variant="tonal" prepend-icon="mdi-pencil-outline" @click="editing = true">Editar</v-btn>
          <v-btn
            :color="patient.active ? 'error' : 'success'"
            variant="text"
            :prepend-icon="patient.active ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
            @click="statusDialog = true"
          >
            {{ patient.active ? 'Inativar' : 'Reativar' }}
          </v-btn>
        </div>
      </div>

      <v-row>
        <v-col cols="12" md="4">
          <v-card elevation="1">
            <v-card-item prepend-icon="mdi-card-account-details-outline" title="Cadastro" />
            <v-list density="compact" class="pt-0">
              <v-list-item v-if="patient.socialName" title="Nome civil" :subtitle="patient.name" />
              <v-list-item title="Nascimento" :subtitle="formatBirthDate(patient.birthDate)" />
              <v-list-item title="Gênero" :subtitle="patient.gender ? GENDER_LABELS[patient.gender] : 'Não informado'" />
              <v-list-item title="Telefone" :subtitle="patient.phone ? formatPhone(patient.phone) : 'Não informado'" />
              <v-list-item title="E-mail" :subtitle="patient.email ?? 'Não informado'" />
              <v-list-item
                title="Contato de emergência"
                :subtitle="patient.emergencyContactName
                  ? `${patient.emergencyContactName}${patient.emergencyContactPhone ? ` · ${formatPhone(patient.emergencyContactPhone)}` : ''}`
                  : 'Não informado'"
              />
            </v-list>
          </v-card>
        </v-col>

        <v-col cols="12" md="8">
          <v-card elevation="1">
            <v-card-item prepend-icon="mdi-clipboard-text-clock-outline" title="Atendimentos">
              <template #append>
                <v-btn v-if="canRecord" color="primary" variant="flat" prepend-icon="mdi-plus" @click="openNewRecord">
                  Registrar atendimento
                </v-btn>
              </template>
            </v-card-item>

            <v-card-text>
              <v-autocomplete
                v-if="professionals.length > 1 || professionalFilter"
                v-model="professionalFilter"
                :items="professionals"
                label="Filtrar por profissional"
                prepend-inner-icon="mdi-filter-outline"
                variant="outlined"
                density="compact"
                clearable
                hide-details
                class="mb-4"
              />

              <v-skeleton-loader v-if="loadingRecords && !records.length" type="list-item-three-line@3" />

              <div v-else-if="!records.length" class="text-center text-medium-emphasis py-8">
                <v-icon icon="mdi-clipboard-outline" size="48" class="mb-2" />
                <p>Nenhum atendimento registrado.</p>
              </div>

              <v-timeline v-else side="end" density="compact" align="start" truncate-line="both">
                <v-timeline-item
                  v-for="record in records"
                  :key="record.id"
                  dot-color="primary"
                  size="small"
                  width="100%"
                >
                  <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-1">
                    <div>
                      <strong>{{ formatDateTime(record.occurredAt) }}</strong>
                      <span class="text-medium-emphasis"> · {{ record.professional.name }}</span>
                    </div>
                    <v-btn
                      v-if="canAmend(record)"
                      variant="text"
                      size="small"
                      prepend-icon="mdi-clipboard-edit-outline"
                      @click="openAmendment(record)"
                    >
                      Adendo
                    </v-btn>
                  </div>
                  <p class="text-body-1 record-notes">{{ record.notes }}</p>

                  <v-sheet
                    v-for="amendment in record.amendments"
                    :key="amendment.id"
                    color="surface-variant"
                    rounded="lg"
                    class="pa-3 mt-3"
                  >
                    <div class="text-caption text-medium-emphasis mb-1">
                      <v-icon icon="mdi-clipboard-edit-outline" size="14" />
                      Adendo de {{ amendment.professional.name }} em {{ formatDateTime(amendment.createdAt) }}
                    </div>
                    <p class="text-body-2 record-notes">{{ amendment.notes }}</p>
                  </v-sheet>
                </v-timeline-item>
              </v-timeline>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <PatientsPatientFormDialog v-model="editing" :patient="patient" @saved="saved => { patient = saved; notify('Cadastro atualizado.') }" />
      <PatientsRecordFormDialog
        v-model="recording"
        :patient-id="patient.id"
        :amending="amending"
        @saved="() => { loadRecords(); notify(amending ? 'Adendo adicionado.' : 'Atendimento registrado.') }"
      />
      <ConfirmDialog
        v-model="statusDialog"
        :title="patient.active ? 'Inativar paciente?' : 'Reativar paciente?'"
        :text="patient.active
          ? 'O paciente sai da lista de ativos e não recebe novos atendimentos. O cadastro e o prontuário são mantidos.'
          : 'O paciente volta para a lista de ativos.'"
        :confirm-text="patient.active ? 'Inativar' : 'Reativar'"
        :color="patient.active ? 'error' : 'success'"
        :loading="changingStatus"
        @confirm="toggleStatus"
      />
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.record-notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
