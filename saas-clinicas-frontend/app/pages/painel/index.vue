<script setup lang="ts">
import type { TeamMember } from '~/types/auth'
import type { ClinicDetails } from '~/types/clinic'
import type { PatientPage } from '~/types/patient'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Painel · SaaS Clínicas' })

const api = useApi()
const { user, isAdmin } = useAuth()

const { data, status, refresh } = await useAsyncData('dashboard', async () => {
  const [clinic, team, patients] = await Promise.all([
    api<ClinicDetails>('/clinics/me'),
    api<TeamMember[]>('/users'),
    api<PatientPage>('/patients', { query: { pageSize: 1 } }),
  ])
  return { clinic, team, patientsCount: patients.total }
})

const activeTeam = computed(() => data.value?.team.filter(member => member.active) ?? [])

const now = useNow()
const todayWeekday = computed(() => now.value.getDay())
const todayLabel = computed(() =>
  now.value.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
)
const openStatus = computed(() =>
  data.value ? openingStatus(data.value.clinic.businessHours, now.value) : null,
)

/** Semana completa, de segunda a domingo, marcando os dias fechados. */
const week = computed(() =>
  WEEKDAYS.map(day => ({
    ...day,
    hours: data.value?.clinic.businessHours.find(hour => hour.weekday === day.value),
  })),
)

const COMING_SOON = [
  { icon: 'mdi-calendar-month-outline', title: 'Agenda', text: 'Agendamentos por profissional, com confirmação e controle de faltas.' },
  { icon: 'mdi-stethoscope', title: 'Profissionais', text: 'Equipe de atendimento com horários e agenda própria.' },
]
</script>

<template>
  <v-container class="py-6" max-width="1200">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">
        Olá, {{ user ? firstName(user.name) : '' }}!
      </h1>
      <p class="text-body-1 text-medium-emphasis text-capitalize-first">
        {{ todayLabel }}
      </p>
    </div>

    <v-alert
      v-if="status === 'error'"
      type="error"
      variant="tonal"
      class="mb-6"
      title="Não foi possível carregar o painel"
      text="Verifique sua conexão e tente novamente."
    >
      <template #append>
        <v-btn variant="text" @click="() => refresh()">Tentar de novo</v-btn>
      </template>
    </v-alert>

    <v-row v-else-if="status === 'pending' || !data">
      <v-col v-for="n in 4" :key="n" cols="12" md="6">
        <v-skeleton-loader type="article" class="rounded-xl" />
      </v-col>
    </v-row>

    <template v-else>
      <v-row>
        <!-- Clínica -->
        <v-col cols="12" md="7">
          <v-card class="h-100" elevation="1">
            <v-card-item prepend-icon="mdi-hospital-building">
              <v-card-title>{{ data.clinic.name }}</v-card-title>
              <v-card-subtitle>Sua clínica</v-card-subtitle>
              <template #append>
                <v-chip
                  v-if="openStatus"
                  :color="openStatus.open ? 'success' : 'default'"
                  :prepend-icon="openStatus.open ? 'mdi-door-open' : 'mdi-door-closed'"
                  variant="tonal"
                >
                  {{ openStatus.open ? 'Aberta' : 'Fechada' }}
                </v-chip>
              </template>
            </v-card-item>

            <v-card-text>
              <p v-if="openStatus" class="text-body-1 mb-4">{{ openStatus.label }}</p>
              <v-list density="compact" class="pa-0 bg-transparent">
                <v-list-item prepend-icon="mdi-email-outline" :title="data.clinic.email" class="px-0" />
                <v-list-item prepend-icon="mdi-phone-outline" :title="formatPhone(data.clinic.phone)" class="px-0" />
                <v-list-item
                  v-if="data.clinic.document"
                  prepend-icon="mdi-card-account-details-outline"
                  :title="formatTaxId(data.clinic.document)"
                  class="px-0"
                />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Horário -->
        <v-col cols="12" md="5">
          <v-card class="h-100" elevation="1">
            <v-card-item prepend-icon="mdi-clock-outline" title="Horário de funcionamento" />
            <v-list density="compact" class="pt-0">
              <v-list-item
                v-for="day in week"
                :key="day.value"
                :active="day.value === todayWeekday"
                color="primary"
                rounded="lg"
                class="mx-2"
              >
                <div class="d-flex justify-space-between">
                  <span :class="{ 'font-weight-bold': day.value === todayWeekday }">
                    {{ day.label }}
                    <span v-if="day.value === todayWeekday" class="text-caption">(hoje)</span>
                  </span>
                  <span :class="day.hours ? '' : 'text-medium-emphasis'">
                    {{ day.hours ? `${day.hours.opensAt} – ${day.hours.closesAt}` : 'Fechado' }}
                  </span>
                </div>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>

        <!-- Pacientes -->
        <v-col cols="12">
          <v-card elevation="1" to="/painel/pacientes" class="pa-2">
            <v-card-item prepend-icon="mdi-account-heart-outline">
              <v-card-title>
                {{ data.patientsCount }} {{ data.patientsCount === 1 ? 'paciente ativo' : 'pacientes ativos' }}
              </v-card-title>
              <v-card-subtitle>Cadastro e prontuário dos pacientes da clínica</v-card-subtitle>
              <template #append>
                <v-icon icon="mdi-chevron-right" />
              </template>
            </v-card-item>
          </v-card>
        </v-col>

        <!-- Equipe -->
        <v-col cols="12">
          <v-card elevation="1">
            <v-card-item prepend-icon="mdi-account-group-outline">
              <v-card-title>Equipe</v-card-title>
              <v-card-subtitle>
                {{ activeTeam.length }} {{ activeTeam.length === 1 ? 'pessoa ativa' : 'pessoas ativas' }}
              </v-card-subtitle>
              <template v-if="isAdmin" #append>
                <v-btn variant="tonal" prepend-icon="mdi-account-cog-outline" to="/painel/equipe">
                  Gerenciar equipe
                </v-btn>
              </template>
            </v-card-item>

            <v-list lines="two">
              <v-list-item
                v-for="member in activeTeam"
                :key="member.id"
                :title="member.name"
                :subtitle="member.email"
              >
                <template #prepend>
                  <v-avatar :color="ROLE_COLORS[primaryRole(member.roles)]" variant="tonal">
                    {{ initials(member.name) }}
                  </v-avatar>
                </template>
                <template #append>
                  <RoleChips :roles="member.roles" />
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>

      <!-- Em breve -->
      <h2 class="text-h6 font-weight-bold mt-8 mb-3">Em breve</h2>
      <v-row>
        <v-col v-for="feature in COMING_SOON" :key="feature.title" cols="12" md="4">
          <v-card variant="tonal" color="primary" class="h-100">
            <v-card-item :prepend-icon="feature.icon" :title="feature.title">
              <template #append>
                <v-chip size="x-small" variant="flat" color="primary">Em breve</v-chip>
              </template>
            </v-card-item>
            <v-card-text class="text-high-emphasis">{{ feature.text }}</v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.text-capitalize-first::first-letter {
  text-transform: uppercase;
}
</style>
