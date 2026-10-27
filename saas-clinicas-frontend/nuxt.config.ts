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

  routeRules: {
    // A área logada depende do refresh token, que só o navegador envia
    // (cookie restrito a /api/auth); por isso renderiza no cliente. O login
    // da clínica renderiza no servidor, já com a cor e o logo dela
    '/painel': { ssr: false },
    '/painel/**': { ssr: false },
    '/trocar-senha': { ssr: false },
    '/master': { ssr: false },
    '/master/**': { ssr: false },
  },

  runtimeConfig: {
    // Endereço do backend usado pelo proxy server/api/[...path].ts.
    // Lido ao iniciar o servidor: sobrescreva com NUXT_API_URL.
    apiUrl: 'http://localhost:3001',
    public: {
      // Domínio raiz: as clínicas ficam em <slug>.<domínio> e o master em
      // admin.<domínio>. Em produção, NUXT_PUBLIC_BASE_DOMAIN=seudominio.com.br
      baseDomain: 'localhost',
    },
  },

  devServer: { port: 3000 },
})
