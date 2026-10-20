<script setup lang="ts">
const password = defineModel<string>({ required: true })

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(password.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <v-text-field
    v-model="password"
    label="Senha provisória"
    prepend-inner-icon="mdi-key-outline"
    autocomplete="off"
    class="font-monospace"
    :hint="`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. Repasse para a pessoa; ela troca no primeiro acesso.`"
    persistent-hint
    :rules="[formRules.required(), formRules.minLength(MIN_PASSWORD_LENGTH)]"
  >
    <template #append-inner>
      <v-tooltip :text="copied ? 'Copiada!' : 'Copiar'" location="top">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
            variant="text"
            size="small"
            aria-label="Copiar senha"
            @click="copy"
          />
        </template>
      </v-tooltip>
      <v-tooltip text="Gerar outra" location="top">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-refresh"
            variant="text"
            size="small"
            aria-label="Gerar outra senha"
            @click="password = generateTemporaryPassword()"
          />
        </template>
      </v-tooltip>
    </template>
  </v-text-field>
</template>
