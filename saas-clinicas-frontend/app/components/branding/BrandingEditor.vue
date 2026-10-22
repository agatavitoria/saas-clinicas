<script setup lang="ts">
import type { ClinicBranding } from '~/types/clinic'

const MAX_LOGO_BYTES = 512 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const props = withDefaults(
  defineProps<{
    branding: ClinicBranding | null
    /** Base das rotas: /clinics/me (admin) ou /platform/clinics/:id (master). */
    basePath: string
    readOnly?: boolean
  }>(),
  { readOnly: false },
)

const emit = defineEmits<{
  'update:branding': [branding: ClinicBranding]
  'notify': [text: string, color?: string]
}>()

const api = useApi()

// Cor
const savedColor = computed(() => props.branding?.primaryColor ?? null)
const draft = ref(savedColor.value ?? DEFAULT_PRIMARY_COLOR)
watch(savedColor, (color) => {
  draft.value = color ?? DEFAULT_PRIMARY_COLOR
})

const validHex = computed(() => HEX_COLOR_PATTERN.test(draft.value))
const contrast = computed(() => (validHex.value ? contrastWithWhite(draft.value) : null))
const contrastOk = computed(() => (contrast.value ?? 0) >= MIN_CONTRAST_RATIO)
const draftColor = computed(() => draft.value.toUpperCase())
const colorChanged = computed(() => draftColor.value !== (savedColor.value ?? DEFAULT_PRIMARY_COLOR))
const pickerOpen = ref(false)
const savingColor = ref(false)

async function saveColor(primaryColor: string | null) {
  savingColor.value = true
  try {
    const branding = await api<ClinicBranding>(`${props.basePath}/branding`, {
      method: 'PATCH',
      body: { primaryColor },
    })
    emit('update:branding', branding)
    emit('notify', primaryColor ? 'Cor principal salva.' : 'A cor padrão foi restaurada.')
  }
  catch (error) {
    emit('notify', errorMessage(error), 'error')
  }
  finally {
    savingColor.value = false
  }
}

// Logo
const logoSrc = computed(() => logoUrl(`${props.basePath}/logo`, props.branding))
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const removeDialog = ref(false)
const removing = ref(false)

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!LOGO_TYPES.includes(file.type)) {
    emit('notify', 'Envie uma imagem PNG, JPG ou WebP.', 'error')
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    emit('notify', 'O logo pode ter no máximo 512 KB.', 'error')
    return
  }

  uploading.value = true
  try {
    const branding = await api<ClinicBranding>(`${props.basePath}/branding/logo`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    emit('update:branding', branding)
    emit('notify', 'Logo atualizado.')
  }
  catch (error) {
    emit('notify', errorMessage(error), 'error')
  }
  finally {
    uploading.value = false
  }
}

async function removeLogo() {
  removing.value = true
  try {
    const branding = await api<ClinicBranding>(`${props.basePath}/branding/logo`, { method: 'DELETE' })
    emit('update:branding', branding)
    emit('notify', 'Logo removido.')
    removeDialog.value = false
  }
  catch (error) {
    emit('notify', errorMessage(error), 'error')
  }
  finally {
    removing.value = false
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12" md="7">
      <div class="text-subtitle-1 font-weight-medium mb-1">Cor principal</div>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Usada nos botões, links e destaques do sistema. Para manter a leitura fácil, a cor precisa
        ter contraste de pelo menos {{ formatContrast(MIN_CONTRAST_RATIO) }} com o branco.
      </p>

      <div class="d-flex flex-wrap ga-2 mb-4" role="radiogroup" aria-label="Sugestões de cor">
        <v-btn
          v-for="color in BRAND_PALETTE"
          :key="color.value"
          :color="color.value"
          :aria-label="color.label"
          :aria-checked="draftColor === color.value"
          :title="color.label"
          :disabled="readOnly"
          role="radio"
          icon
          size="40"
          variant="flat"
          @click="draft = color.value"
        >
          <v-icon v-if="draftColor === color.value" icon="mdi-check" />
        </v-btn>
      </div>

      <v-text-field
        v-model.trim="draft"
        label="Cor personalizada (hexadecimal)"
        placeholder="#00696B"
        maxlength="7"
        :disabled="readOnly"
        :error-messages="
          !validHex
            ? 'Use o formato #RRGGBB'
            : !contrastOk
              ? `Contraste de ${formatContrast(contrast!)} com o branco: escolha uma cor mais escura`
              : []
        "
        :hint="contrastOk ? `Contraste de ${formatContrast(contrast!)} com o branco` : undefined"
        persistent-hint
        style="max-width: 360px"
      >
        <template #prepend-inner>
          <v-menu v-model="pickerOpen" :close-on-content-click="false" :disabled="readOnly">
            <template #activator="{ props: menuProps }">
              <button
                v-bind="menuProps"
                type="button"
                class="color-swatch"
                :style="{ background: validHex ? draft : 'transparent' }"
                aria-label="Abrir seletor de cor"
              />
            </template>
            <v-color-picker
              :model-value="validHex ? draft : DEFAULT_PRIMARY_COLOR"
              mode="hex"
              :modes="['hex']"
              @update:model-value="(value: string) => (draft = value.toUpperCase())"
            />
          </v-menu>
        </template>
      </v-text-field>

      <div class="d-flex flex-wrap align-center ga-2 mt-4">
        <span class="text-body-2 text-medium-emphasis me-2">Prévia:</span>
        <v-btn :color="validHex ? draft : undefined" variant="flat" prepend-icon="mdi-calendar-plus" tabindex="-1">
          Botão
        </v-btn>
        <v-chip :color="validHex ? draft : undefined" variant="tonal">Destaque</v-chip>
        <span :style="{ color: validHex ? draft : undefined }" class="font-weight-medium">Link</span>
      </div>

      <div class="d-flex flex-wrap ga-2 mt-6">
        <v-btn
          color="primary"
          variant="flat"
          :disabled="readOnly || !validHex || !contrastOk || !colorChanged"
          :loading="savingColor"
          @click="saveColor(draftColor === DEFAULT_PRIMARY_COLOR ? null : draftColor)"
        >
          Salvar cor
        </v-btn>
        <v-btn
          v-if="savedColor"
          variant="text"
          :disabled="readOnly || savingColor"
          @click="saveColor(null)"
        >
          Restaurar padrão
        </v-btn>
      </div>
    </v-col>

    <v-col cols="12" md="5">
      <div class="text-subtitle-1 font-weight-medium mb-1">Logo</div>
      <p class="text-body-2 text-medium-emphasis mb-4">
        PNG, JPG ou WebP com até 512 KB. Prefira uma imagem quadrada com fundo transparente.
      </p>

      <div class="logo-preview d-flex align-center justify-center rounded-lg mb-4">
        <img v-if="logoSrc" :src="logoSrc" alt="Logo atual da clínica">
        <div v-else class="text-center text-medium-emphasis">
          <v-icon icon="mdi-image-outline" size="40" />
          <div class="text-body-2">Sem logo</div>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        :accept="LOGO_TYPES.join(',')"
        class="d-none"
        @change="onFileChosen"
      >
      <div class="d-flex flex-wrap ga-2">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-upload"
          :disabled="readOnly"
          :loading="uploading"
          @click="fileInput?.click()"
        >
          {{ logoSrc ? 'Trocar logo' : 'Enviar logo' }}
        </v-btn>
        <v-btn
          v-if="logoSrc"
          variant="text"
          color="error"
          :disabled="readOnly || uploading"
          @click="removeDialog = true"
        >
          Remover
        </v-btn>
      </div>
    </v-col>

    <ConfirmDialog
      v-model="removeDialog"
      title="Remover o logo?"
      text="O sistema volta a mostrar o ícone padrão no lugar do logo."
      confirm-text="Remover"
      color="error"
      :loading="removing"
      @confirm="removeLogo"
    />
  </v-row>
</template>

<style scoped>
.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: pointer;
}

.logo-preview {
  width: 160px;
  height: 160px;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-background));
}

.logo-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
