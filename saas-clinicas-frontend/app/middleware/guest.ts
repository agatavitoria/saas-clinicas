/** Páginas só para visitantes (ex.: login): quem já entrou segue adiante. */
export default defineNuxtRouteMiddleware(async () => {
  const { ensureLoaded } = useAuth()
  const user = await ensureLoaded()
  if (user) return navigateTo(user.mustChangePassword ? '/trocar-senha' : '/painel')
})
