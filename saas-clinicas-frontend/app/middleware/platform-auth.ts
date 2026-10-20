/** Exige a sessão do admin master. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureLoaded } = usePlatformAuth()
  if (await ensureLoaded()) return

  return navigateTo({ path: '/master/login', query: { redirect: to.fullPath } })
})
