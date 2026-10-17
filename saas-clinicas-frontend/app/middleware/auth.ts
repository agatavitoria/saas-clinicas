/** Exige sessão: sem usuário logado, vai para o login e volta depois. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureLoaded } = useAuth()
  if (await ensureLoaded()) return

  return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
