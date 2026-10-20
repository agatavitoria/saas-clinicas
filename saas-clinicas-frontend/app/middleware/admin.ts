/** Páginas só para administradores da clínica (usar depois de `auth`). */
export default defineNuxtRouteMiddleware(() => {
  const { isAdmin } = useAuth()
  if (!isAdmin.value) return navigateTo('/painel')
})
