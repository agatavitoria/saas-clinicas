const CHANGE_PASSWORD_PATH = '/trocar-senha'

/**
 * Exige sessão de clínica. Sem usuário, vai para o login e volta depois;
 * com senha provisória, só a tela de troca de senha fica liberada.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureLoaded } = useAuth()
  const user = await ensureLoaded()

  if (!user) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (user.mustChangePassword && to.path !== CHANGE_PASSWORD_PATH) {
    return navigateTo(CHANGE_PASSWORD_PATH)
  }
})
