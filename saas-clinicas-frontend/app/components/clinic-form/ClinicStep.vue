<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import type { ClinicForm } from '~/types/clinic'

const clinic = defineModel<ClinicForm['clinic']>({ required: true })

const form = ref<VForm>()

defineExpose({
  validate: async () => (await form.value?.validate())?.valid ?? false,
})
</script>

<template>
  <v-form ref="form" @submit.prevent>
    <p class="text-body-2 text-medium-emphasis mb-6">
      Dados de contato da clínica. Eles aparecem para a equipe e, no futuro,
      para os pacientes.
    </p>

    <v-row density="compact">
      <v-col cols="12">
        <v-text-field
          v-model="clinic.name"
          label="Nome da clínica"
          prepend-inner-icon="mdi-hospital-building"
          autocomplete="organization"
          autofocus
          :rules="[formRules.required(), formRules.minLength(2)]"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="clinic.email"
          label="E-mail de contato"
          type="email"
          prepend-inner-icon="mdi-email-outline"
          autocomplete="email"
          :rules="[formRules.required(), formRules.email]"
        />
      </v-col>

      <v-col cols="12" md="6">
        <MaskedTextField
          v-model="clinic.phone"
          mask="phone"
          label="Telefone"
          type="tel"
          placeholder="(11) 99999-8888"
          prepend-inner-icon="mdi-phone-outline"
          :rules="[formRules.required(), formRules.phone]"
        />
      </v-col>

      <v-col cols="12">
        <MaskedTextField
          v-model="clinic.document"
          mask="taxId"
          label="CNPJ ou CPF (opcional)"
          prepend-inner-icon="mdi-card-account-details-outline"
          hint="Usado em recibos e documentos emitidos pela clínica"
          persistent-hint
          :rules="[formRules.taxId]"
        />
      </v-col>
    </v-row>
  </v-form>
</template>
