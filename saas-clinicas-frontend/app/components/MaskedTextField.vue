<script setup lang="ts">
/**
 * Campo de texto com máscara (telefone, CPF, CPF/CNPJ). Limita o tamanho e
 * garante que o campo sempre mostre o valor formatado: quando a máscara
 * descarta o que foi digitado (letra, dígito a mais), o valor não muda e o
 * Vue não atualizaria o input sozinho.
 *
 * Os demais atributos (label, rules, hint...) vão direto para o v-text-field.
 */
type Mask = 'phone' | 'cpf' | 'taxId'

const model = defineModel<string | null>({ required: true })
const props = defineProps<{ mask: Mask }>()

const FORMATTERS: Record<Mask, (value: string) => string> = {
  phone: formatPhone,
  cpf: formatCpf,
  taxId: formatTaxId,
}

/** Tamanho do texto já formatado: (11) 99999-8888, 000.000.000-00, 00.000.000/0000-00 */
const MAX_LENGTH: Record<Mask, number> = { phone: 15, cpf: 14, taxId: 18 }

async function onUpdate(value: string | null) {
  const typed = value ?? ''
  const formatted = FORMATTERS[props.mask](typed)

  if (formatted === (model.value ?? '') && formatted !== typed) {
    // Mesmo valor de antes: passa pelo texto digitado para forçar o input
    // a ser redesenhado com o valor formatado
    model.value = typed
    await nextTick()
  }
  model.value = formatted
}
</script>

<template>
  <v-text-field
    :model-value="model ?? ''"
    :maxlength="MAX_LENGTH[mask]"
    inputmode="numeric"
    autocomplete="off"
    @update:model-value="onUpdate"
  />
</template>
