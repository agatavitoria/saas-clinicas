<template>
  <v-app>
    <v-app-bar flat border="b" color="surface">
      <template #prepend>
        <v-icon icon="mdi-hospital-building" color="primary" class="ms-2" />
      </template>
      <v-app-bar-title>
        <NuxtLink to="/" class="text-decoration-none text-high-emphasis">
          SaaS Clínicas
        </NuxtLink>
      </v-app-bar-title>
    </v-app-bar>

    <v-main class="bg-background">
      <slot />
    </v-main>
  </v-app>
</template>
