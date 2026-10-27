/** Subdomínio do painel do master. */
export const PLATFORM_SUBDOMAIN = 'admin'

/**
 * Área do sistema conforme o endereço acessado:
 * - `root`: o domínio raiz (só o campo para digitar o endereço da clínica);
 * - `admin`: admin.<domínio>, o painel do master;
 * - `clinic`: <slug>.<domínio>, o login e o painel de uma clínica.
 * Qualquer outro host (ex.: um IP) se comporta como a raiz.
 */
export type HostArea =
  | { area: 'root' }
  | { area: 'admin' }
  | { area: 'clinic', slug: string }

/** `host` pode trazer a porta (ex.: "sorriso.localhost:3000"). */
export function resolveHostArea(host: string, baseDomain: string): HostArea {
  const hostname = host.toLowerCase().replace(/:\d+$/, '')
  const suffix = `.${baseDomain.toLowerCase()}`
  if (!hostname.endsWith(suffix)) return { area: 'root' }

  const subdomain = hostname.slice(0, -suffix.length)
  if (subdomain === PLATFORM_SUBDOMAIN) return { area: 'admin' }
  return isValidSlug(subdomain) ? { area: 'clinic', slug: subdomain } : { area: 'root' }
}

/**
 * Endereço de uma área, mantendo o protocolo e a porta do endereço atual
 * (em desenvolvimento, http e :3000).
 */
export function areaOrigin(current: URL, baseDomain: string, subdomain?: string): string {
  const port = current.port ? `:${current.port}` : ''
  const hostname = subdomain ? `${subdomain}.${baseDomain}` : baseDomain
  return `${current.protocol}//${hostname}${port}`
}
