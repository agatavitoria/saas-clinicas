import type { UserProfile } from '~/types/auth'

/** Sessão do usuário de clínica. */
export function useAuth() {
  const api = useApi()
  const user = useAuthUser()
  const loaded = useState('auth:loaded', () => false)

  /** Carrega o usuário da sessão atual (renovando-a se preciso). */
  async function fetchUser(): Promise<UserProfile | null> {
    try {
      user.value = await api<UserProfile>('/auth/me')
    }
    catch {
      user.value = null
    }
    loaded.value = true
    return user.value
  }

  async function ensureLoaded(): Promise<UserProfile | null> {
    return loaded.value ? user.value : fetchUser()
  }

  async function login(email: string, password: string): Promise<UserProfile> {
    const response = await api<{ user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setUser(response.user)
    return response.user
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const response = await api<{ user: UserProfile }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    })
    setUser(response.user)
  }

  async function logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' })
    }
    finally {
      setUser(null)
      await navigateTo('/login')
    }
  }

  function setUser(value: UserProfile | null) {
    user.value = value
    loaded.value = true
  }

  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  return { user, isAdmin, login, logout, changePassword, ensureLoaded }
}
