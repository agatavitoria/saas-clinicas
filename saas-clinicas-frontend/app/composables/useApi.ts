import type { UserProfile } from '~/types/auth'

type ApiFetch = typeof $fetch

/** Usuário logado, compartilhado entre useApi e useAuth. */
export const useAuthUser = () => useState<UserProfile | null>('auth:user', () => null)

/** Uma renovação de sessão por vez, mesmo com várias chamadas falhando juntas. */
let refreshing: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshing ??= $fetch('/api/auth/refresh', { method: 'POST' })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export const statusOf = (error: unknown): number | undefined =>
  (error as { statusCode?: number } | null)?.statusCode

/**
 * Cliente da API (via proxy /api). Se o access token expirou, renova a
 * sessão uma vez e repete a chamada; se não der, limpa o usuário logado.
 */
export function useApi(): ApiFetch {
  const user = useAuthUser()
  const api = $fetch.create({ baseURL: '/api' })

  const request = (async (url: string, options?: object) => {
    try {
      return await api(url, options)
    }
    catch (error) {
      if (statusOf(error) !== 401 || url.startsWith('/auth/')) throw error

      if (!(await refreshSession())) {
        user.value = null
        throw error
      }
      return api(url, options)
    }
  }) as ApiFetch

  return request
}
