/** Páginas só para visitantes (ex.: login): quem já entrou vai ao painel. */
export default defineNuxtRouteMiddleware(async () => {
  const { ensureLoaded } = useAuth()
  if (await ensureLoaded()) return navigateTo('/painel')
})
