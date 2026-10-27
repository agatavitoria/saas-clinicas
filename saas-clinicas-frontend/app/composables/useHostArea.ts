/**
 * Área do sistema do endereço atual (raiz, master ou clínica). Funciona no
 * servidor e no navegador.
 */
export function useHostArea(): HostArea {
  const { baseDomain } = useRuntimeConfig().public
  return resolveHostArea(useRequestURL().host, baseDomain)
}

/** Endereços das outras áreas, no mesmo protocolo e porta do atual. */
export function useAreaUrls() {
  const { baseDomain } = useRuntimeConfig().public
  const current = useRequestURL()

  return {
    rootUrl: () => areaOrigin(current, baseDomain),
    clinicUrl: (slug: string) => areaOrigin(current, baseDomain, slug),
    /** Domínio exibido depois do slug (ex.: ".localhost:3000"). */
    clinicHostSuffix: `.${baseDomain}${current.port ? `:${current.port}` : ''}`,
  }
}
