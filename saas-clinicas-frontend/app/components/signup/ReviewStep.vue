<script setup lang="ts">
import type { ClinicSignupForm } from '~/types/clinic'

const props = defineProps<{ form: ClinicSignupForm }>()

const emit = defineEmits<{ edit: [step: number] }>()

const openHours = computed(() => props.form.businessHours.filter(hour => hour.open))
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Confira as informações antes de criar a clínica.
    </p>

    <v-card variant="outlined" class="mb-4">
      <v-card-item prepend-icon="mdi-hospital-building" title="Clínica">
        <template #append>
          <v-btn variant="text" size="small" @click="emit('edit', 1)">Editar</v-btn>
        </template>
      </v-card-item>
      <v-card-text>
        <div class="text-body-1 font-weight-medium">{{ form.clinic.name }}</div>
        <div>{{ form.clinic.email }}</div>
        <div>{{ form.clinic.phone }}</div>
        <div v-if="form.clinic.document">{{ form.clinic.document }}</div>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="mb-4">
      <v-card-item prepend-icon="mdi-clock-outline" title="Horário de funcionamento">
        <template #append>
          <v-btn variant="text" size="small" @click="emit('edit', 2)">Editar</v-btn>
        </template>
      </v-card-item>
      <v-card-text>
        <div v-for="hour in openHours" :key="hour.weekday" class="d-flex justify-space-between">
          <span>{{ weekdayLabel(hour.weekday) }}</span>
          <span>{{ hour.opensAt }} – {{ hour.closesAt }}</span>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="outlined">
      <v-card-item prepend-icon="mdi-account-key-outline" title="Administrador">
        <template #append>
          <v-btn variant="text" size="small" @click="emit('edit', 3)">Editar</v-btn>
        </template>
      </v-card-item>
      <v-card-text>
        <div class="text-body-1 font-weight-medium">{{ form.admin.name }}</div>
        <div>{{ form.admin.email }}</div>
      </v-card-text>
    </v-card>
  </div>
</template>
