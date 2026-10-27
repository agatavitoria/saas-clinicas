/** Rotas da API que cada área do sistema pode chamar. */
function isAllowed(target: HostArea, path: string): boolean {
  if (path.startsWith('/api/public/')) return true
  const platform = path.startsWith('/api/platform/')
  switch (target.area) {
    case 'admin':
      return platform
    case 'clinic':
      return !platform
    case 'root':
      return false
  }
}

/**
 * Proxy /api/** → backend. O front fala só com a própria origem, então os
 * cookies de sessão (httpOnly) ficam presos ao subdomínio acessado.
 *
 * O subdomínio decide o que pode ser chamado: rotas do master só em admin.,
 * rotas de clínica só no endereço de uma clínica. Nele, o proxy informa o
 * slug ao backend (X-Clinic-Slug), que restringe o login e a sessão àquela
 * clínica.
 *
 * O X-Forwarded-For e o X-Clinic-Slug enviados pelo navegador são
 * descartados e substituídos: sem isso, qualquer cliente poderia forjar o IP
 * gravado na auditoria ou a clínica do login. (Atrás de um load balancer em
 * produção, troque getRequestIP(event) pelo IP que ele informa.)
 */
export default defineEventHandler((event) => {
  const { apiUrl, public: { baseDomain } } = useRuntimeConfig(event)
  const target = resolveHostArea(getRequestHost(event), baseDomain)

  if (!isAllowed(target, event.path)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  delete event.node.req.headers['x-clinic-slug']
  return proxyRequest(event, `${apiUrl}${event.path}`, {
    headers: {
      'x-forwarded-for': getRequestIP(event) ?? '',
      ...(target.area === 'clinic' ? { 'x-clinic-slug': target.slug } : {}),
    },
  })
})
