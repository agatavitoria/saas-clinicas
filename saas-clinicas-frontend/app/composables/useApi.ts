import type { PlatformAdminProfile, UserProfile } from '~/types/auth'

type ApiFetch = typeof $fetch
type SessionKind = 'tenant' | 'platform'

/** Usuário de clínica logado, compartilhado entre useApi e useAuth. */
export const useAuthUser = () => useState<UserProfile | null>('auth:user', () => null)

/** Admin master logado, compartilhado entre useApi e usePlatformAuth. */
export const usePlatformAdmin = () =>
  useState<PlatformAdminProfile | null>('platform:admin', () => null)

const callRefresh = (kind: SessionKind) =>
  kind === 'platform'
    ? $fetch('/api/platform/auth/refresh', { method: 'POST' })
    : $fetch('/api/auth/refresh', { method: 'POST' })

/** Uma renovação por vez para cada tipo de sessão. */
const refreshing = new Map<SessionKind, Promise<boolean>>()

function refreshSession(kind: SessionKind): Promise<boolean> {
  let pending = refreshing.get(kind)
  if (!pending) {
    pending = callRefresh(kind)
      .then(() => true)
      .catch(() => false)
      .finally(() => refreshing.delete(kind))
    refreshing.set(kind, pending)
  }
  return pending
}

const isAuthRoute = (url: string) =>
  url.startsWith('/auth/') || url.startsWith('/platform/auth/')

/**
 * Cliente da API (via proxy /api). Se o access token expirou, renova a
 * sessão correspondente (clínica ou master) uma vez e repete a chamada; se
 * não der, limpa quem estava logado.
 */
export function useApi(): ApiFetch {
  const user = useAuthUser()
  const platformAdmin = usePlatformAdmin()
  // Tipado de forma simples: a inferência de rotas do Nitro não lida com
  // um caminho qualquer; o tipo público continua sendo o do $fetch
  const api = $fetch.create({ baseURL: '/api' }) as (
    url: string,
    options?: object,
  ) => Promise<unknown>

  const request = (async (url: string, options?: object) => {
    try {
      return await api(url, options)
    }
    catch (error) {
      if (statusOf(error) !== 401 || isAuthRoute(url)) throw error

      const kind: SessionKind = url.startsWith('/platform/') ? 'platform' : 'tenant'
      if (!(await refreshSession(kind))) {
        if (kind === 'platform') platformAdmin.value = null
        else user.value = null
        throw error
      }
      return api(url, options)
    }
  }) as ApiFetch

  return request
}
