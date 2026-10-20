<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth', 'admin'] })
useHead({ title: 'Equipe · SaaS Clínicas' })

const { user } = useAuth()
</script>

<template>
  <v-container class="py-6" max-width="1200">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Equipe</h1>
      <p class="text-body-1 text-medium-emphasis">
        Cadastre quem usa o sistema na sua clínica e controle o acesso de cada
        pessoa.
      </p>
    </div>

    <v-card elevation="1" class="pa-4">
      <UsersTable base-path="/users" :current-user-id="user?.id" />
    </v-card>
  </v-container>
</template>
