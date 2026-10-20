/** Login do master: quem já entrou vai direto para a lista de clínicas. */
export default defineNuxtRouteMiddleware(async () => {
  const { ensureLoaded } = usePlatformAuth()
  if (await ensureLoaded()) return navigateTo('/master')
})
