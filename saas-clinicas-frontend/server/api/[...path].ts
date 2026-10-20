/**
 * Proxy /api/** → backend. O front fala só com a própria origem, então os
 * cookies de sessão (httpOnly) ficam no mesmo domínio.
 *
 * O X-Forwarded-For enviado pelo navegador é descartado e substituído pelo
 * endereço real da conexão: sem isso, qualquer cliente poderia forjar o IP
 * gravado na auditoria. (Atrás de um load balancer em produção, troque
 * getRequestIP(event) pelo IP que ele informa.)
 */
export default defineEventHandler((event) => {
  const { apiUrl } = useRuntimeConfig(event)

  return proxyRequest(event, `${apiUrl}${event.path}`, {
    headers: { 'x-forwarded-for': getRequestIP(event) ?? '' },
  })
})
