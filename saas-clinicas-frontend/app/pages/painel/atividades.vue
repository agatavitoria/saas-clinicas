<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'admin'] })
useHead({ title: 'Atividades · SaaS Clínicas' })
</script>

<template>
  <v-container class="py-6" max-width="1000">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Atividades</h1>
      <p class="text-body-1 text-medium-emphasis">
        Histórico de tudo o que aconteceu na clínica: acessos, mudanças na
        equipe e ações sobre os dados. Os registros não podem ser alterados.
      </p>
    </div>

    <v-card elevation="1" class="pa-4">
      <AuditLogList base-path="/audit-logs" />
    </v-card>
  </v-container>
</template>
