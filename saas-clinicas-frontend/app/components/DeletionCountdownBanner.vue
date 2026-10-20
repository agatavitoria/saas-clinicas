<script setup lang="ts">
const { clinic, readOnly, daysUntilDeletion, cancelDeletion } = useClinic()
const { isAdmin } = useAuth()

const confirming = ref(false)
const cancelling = ref(false)
const error = ref('')

const countdown = computed(() => {
  const days = daysUntilDeletion.value
  if (days === null) return ''
  if (days === 0) return 'A exclusão definitiva acontece hoje'
  return days === 1 ? 'Falta 1 dia para a exclusão definitiva' : `Faltam ${days} dias para a exclusão definitiva`
})

async function cancel() {
  cancelling.value = true
  error.value = ''
  try {
    await cancelDeletion()
    confirming.value = false
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    cancelling.value = false
  }
}
</script>

<template>
  <v-alert
    v-if="readOnly && clinic"
    type="error"
    variant="tonal"
    icon="mdi-delete-clock-outline"
    rounded="0"
    class="deletion-banner"
  >
    <div class="d-flex flex-wrap align-center justify-space-between ga-3">
      <div>
        <div class="font-weight-bold">{{ countdown }}</div>
        <div class="text-body-2">
          Os dados de {{ clinic.name }} serão excluídos em
          {{ formatDate(clinic.deletion.scheduledFor!) }}. Até lá, o sistema fica
          <strong>somente para consulta</strong>.
          <span v-if="!isAdmin">Para cancelar, fale com o administrador da clínica.</span>
        </div>
      </div>
      <v-btn v-if="isAdmin" color="error" variant="flat" prepend-icon="mdi-delete-restore" @click="confirming = true">
        Cancelar exclusão
      </v-btn>
    </div>

    <ConfirmDialog
      v-model="confirming"
      title="Cancelar a exclusão?"
      :text="`A exclusão de ${clinic.name} será cancelada e o sistema volta a funcionar normalmente.${error ? ` ${error}` : ''}`"
      confirm-text="Cancelar exclusão"
      color="success"
      :loading="cancelling"
      @confirm="cancel"
    />
  </v-alert>
</template>

<style scoped>
.deletion-banner {
  border-bottom: 1px solid rgba(var(--v-theme-error), 0.3);
}
</style>
