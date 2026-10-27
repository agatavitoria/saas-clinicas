/** Páginas só para visitantes (ex.: login): quem já entrou segue adiante. */
export default defineNuxtRouteMiddleware(async () => {
  // A sessão só é conhecida no navegador (o refresh token não chega ao SSR)
  if (import.meta.server) return
  const { ensureLoaded } = useAuth()
  const user = await ensureLoaded()
  if (user) return navigateTo(user.mustChangePassword ? '/trocar-senha' : '/painel')
})
