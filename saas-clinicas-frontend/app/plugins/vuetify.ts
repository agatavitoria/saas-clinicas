import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { pt } from 'vuetify/locale'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    locale: { locale: 'pt', messages: { pt } },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            // A cor da clínica substitui esta no painel (ver layouts/dashboard.vue)
            primary: DEFAULT_PRIMARY_COLOR,
            secondary: '#4A6363',
            tertiary: '#4B607C',
            error: '#BA1A1A',
            success: '#2E7D32',
            background: '#F4FBFA',
            surface: '#FFFFFF',
          },
        },
      },
    },
    defaults: {
      VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
      VBtn: { rounded: 'pill' },
      VCard: { rounded: 'xl' },
      VSwitch: { color: 'primary', inset: true, hideDetails: true },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
