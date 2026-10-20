import type { PlatformAdminProfile } from '~/types/auth'

/** Sessão do admin master (separada da sessão de clínica). */
export function usePlatformAuth() {
  const api = useApi()
  const admin = usePlatformAdmin()
  const loaded = useState('platform:loaded', () => false)

  async function ensureLoaded(): Promise<PlatformAdminProfile | null> {
    if (loaded.value) return admin.value
    try {
      admin.value = await api<PlatformAdminProfile>('/platform/auth/me')
    }
    catch {
      admin.value = null
    }
    loaded.value = true
    return admin.value
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await api<{ admin: PlatformAdminProfile }>('/platform/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    admin.value = response.admin
    loaded.value = true
  }

  async function logout(): Promise<void> {
    try {
      await api('/platform/auth/logout', { method: 'POST' })
    }
    finally {
      admin.value = null
      loaded.value = true
      await navigateTo('/master/login')
    }
  }

  return { admin, login, logout, ensureLoaded }
}
