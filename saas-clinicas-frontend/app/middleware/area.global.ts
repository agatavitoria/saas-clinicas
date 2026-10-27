/** Páginas de cada área; o primeiro caminho é o destino padrão. */
const AREA_PAGES: Record<HostArea['area'], string[]> = {
  root: ['/'],
  admin: ['/master'],
  clinic: ['/login', '/painel', '/trocar-senha'],
}

const isUnder = (path: string, prefix: string) =>
  prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`)

/**
 * Cada endereço só mostra as páginas da própria área: o master fica em
 * admin.<domínio>, as clínicas em <slug>.<domínio> e a raiz só pergunta o
 * endereço da clínica. Uma página de outra área leva ao início desta.
 */
export default defineNuxtRouteMiddleware((to) => {
  // Rota inexistente: deixa o Nuxt mostrar a página de erro
  if (!to.matched.length) return

  const pages = AREA_PAGES[useHostArea().area]
  if (!pages.some(prefix => isUnder(to.path, prefix))) return navigateTo(pages[0])
})
