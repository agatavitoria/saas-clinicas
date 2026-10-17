<script setup lang="ts">
useHead({ title: 'SaaS Clínicas' })

const features = [
  { icon: 'mdi-calendar-clock', title: 'Agenda por profissional', text: 'Cada profissional com seus horários e atendimentos.' },
  { icon: 'mdi-account-group-outline', title: 'Pacientes organizados', text: 'Cadastro e histórico de agendamentos em um só lugar.' },
  { icon: 'mdi-shield-lock-outline', title: 'Dados isolados', text: 'As informações da sua clínica são só da sua clínica.' },
]
</script>

<template>
  <v-container class="py-12" max-width="1080">
    <v-row align="center" justify="center">
      <v-col cols="12" md="7" class="text-center text-md-start">
        <h1 class="text-h3 font-weight-bold mb-4">
          A agenda da sua clínica, simples e organizada
        </h1>
        <p class="text-h6 text-medium-emphasis font-weight-regular mb-8">
          Cadastre sua clínica em poucos minutos e comece a organizar
          profissionais, pacientes e agendamentos.
        </p>
        <v-btn
          to="/cadastro"
          color="primary"
          size="x-large"
          prepend-icon="mdi-plus"
        >
          Cadastrar minha clínica
        </v-btn>
      </v-col>
    </v-row>

    <v-row class="mt-12">
      <v-col v-for="feature in features" :key="feature.title" cols="12" md="4">
        <v-card variant="tonal" color="primary" class="h-100 pa-2">
          <v-card-item :prepend-icon="feature.icon" :title="feature.title" />
          <v-card-text class="text-high-emphasis">{{ feature.text }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
