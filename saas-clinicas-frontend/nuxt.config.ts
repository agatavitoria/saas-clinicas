import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    // Integração recomendada pelo Vuetify: importa só os componentes usados
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        config.plugins?.push(vuetify({ autoImport: true }))
      })
    },
  ],

  build: { transpile: ['vuetify'] },

  css: ['@mdi/font/css/materialdesignicons.css'],

  vite: {
    vue: { template: { transformAssetUrls } },
  },

  app: {
    head: {
      title: 'SaaS Clínicas',
      htmlAttrs: { lang: 'pt-BR' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Sobrescreva com NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:3001',
    },
  },

  devServer: { port: 3000 },
})
