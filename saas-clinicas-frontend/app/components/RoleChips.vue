<script setup lang="ts">
import type { UserRole } from '~/types/auth'

defineProps<{ roles: UserRole[], size?: string }>()
</script>

<template>
  <div class="d-flex flex-wrap ga-1">
    <v-chip
      v-for="role in sortRoles(roles)"
      :key="role"
      :size="size ?? 'small'"
      variant="tonal"
      :color="ROLE_COLORS[role]"
    >
      {{ ROLE_LABELS[role] }}
    </v-chip>
  </div>
</template>
