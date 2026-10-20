import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

/** Endereço do backend usado pelo proxy /api (lido no build/dev). */
const API_URL = process.env.API_URL ?? 'http://localhost:3001'

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

  routeRules: {
    // O front fala só com /api; os cookies de sessão ficam na mesma origem
    '/api/**': { proxy: `${API_URL}/api/**` },
    // A área logada depende do refresh token, que só o navegador envia
    // (cookie restrito a /api/auth); por isso renderiza no cliente
    '/painel': { ssr: false },
    '/painel/**': { ssr: false },
    '/login': { ssr: false },
    '/trocar-senha': { ssr: false },
    '/master': { ssr: false },
    '/master/**': { ssr: false },
  },

  devServer: { port: 3000 },
})
