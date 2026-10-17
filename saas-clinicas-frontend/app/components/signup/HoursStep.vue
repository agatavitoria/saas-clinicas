<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { BusinessHourForm } from '~/types/clinic'

const hours = defineModel<BusinessHourForm[]>({ required: true })

const form = ref<VForm>()
const showNoDayError = ref(false)

const hasOpenDay = computed(() => hours.value.some(hour => hour.open))

watch(hasOpenDay, (open) => {
  if (open) showNoDayError.value = false
})

const closesAfterOpens = (hour: BusinessHourForm) => () =>
  !hour.open || hour.closesAt > hour.opensAt || 'Deve ser depois da abertura'

/** Copia o horário de segunda para os demais dias úteis. */
function copyMondayToWeekdays() {
  const monday = hours.value.find(hour => hour.weekday === 1)
  if (!monday) return

  for (const hour of hours.value) {
    if (hour.weekday >= 1 && hour.weekday <= 5) {
      hour.open = monday.open
      hour.opensAt = monday.opensAt
      hour.closesAt = monday.closesAt
    }
  }
}

defineExpose({
  validate: async () => {
    showNoDayError.value = !hasOpenDay.value
    const valid = (await form.value?.validate())?.valid ?? false
    return valid && hasOpenDay.value
  },
})
</script>

<template>
  <v-form ref="form" @submit.prevent>
    <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-4">
      <p class="text-body-2 text-medium-emphasis">
        Defina os dias e horários de atendimento. Você pode ajustar isso depois.
      </p>
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-content-copy"
        @click="copyMondayToWeekdays"
      >
        Copiar segunda para seg–sex
      </v-btn>
    </div>

    <v-alert
      v-if="showNoDayError"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
      text="Abra pelo menos um dia da semana."
    />

    <v-list lines="two" class="py-0 bg-transparent">
      <template v-for="(hour, index) in hours" :key="hour.weekday">
        <v-divider v-if="index > 0" />
        <v-list-item class="px-0 py-2">
          <v-row align="center" density="compact">
            <v-col cols="12" sm="4" class="d-flex align-center ga-3">
              <v-switch
                v-model="hour.open"
                :aria-label="`Aberto ${weekdayLabel(hour.weekday)}`"
              />
              <div>
                <div class="text-body-1 font-weight-medium">
                  {{ weekdayLabel(hour.weekday) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ hour.open ? 'Aberto' : 'Fechado' }}
                </div>
              </div>
            </v-col>

            <template v-if="hour.open">
              <v-col cols="6" sm="4">
                <v-text-field
                  v-model="hour.opensAt"
                  label="Abre às"
                  type="time"
                  density="compact"
                  :rules="[formRules.time]"
                />
              </v-col>
              <v-col cols="6" sm="4">
                <v-text-field
                  v-model="hour.closesAt"
                  label="Fecha às"
                  type="time"
                  density="compact"
                  :rules="[formRules.time, closesAfterOpens(hour)]"
                />
              </v-col>
            </template>
          </v-row>
        </v-list-item>
      </template>
    </v-list>
  </v-form>
</template>
