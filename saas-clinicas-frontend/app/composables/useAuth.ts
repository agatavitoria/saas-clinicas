import type { UserProfile, UserRole } from '~/types/auth'

/** Sessão do usuário de clínica. */
export function useAuth() {
  const api = useApi()
  const user = useAuthUser()
  const loaded = useState('auth:loaded', () => false)
  const clinic = useState('clinic:current', () => null)

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

  /**
   * Recarrega o perfil (ex.: papéis alterados). Só encerra a sessão local se
   * ela realmente acabou (401); falha de rede mantém o usuário como estava.
   */
  async function refreshUser(): Promise<void> {
    try {
      setUser(await api<UserProfile>('/auth/me'))
    }
    catch (error) {
      if (statusOf(error) === 401) setUser(null)
    }
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
    // Outra conta (ou logout): descarta os dados da clínica anterior
    if (value?.tenantId !== user.value?.tenantId) clinic.value = null
    user.value = value
    loaded.value = true
  }

  /** Tem pelo menos um dos papéis (um usuário pode ter vários). */
  const hasRole = (...roles: UserRole[]) =>
    roles.some(role => user.value?.roles.includes(role) ?? false)

  const isAdmin = computed(() => hasRole('ADMIN'))
  /** Recepção e admin cadastram, editam e inativam pacientes. */
  const canManagePatients = computed(() => hasRole('RECEPTION', 'ADMIN'))
  /** Profissional e admin registram atendimentos. */
  const canWriteRecords = computed(() => hasRole('PROFESSIONAL', 'ADMIN'))

  return { user, hasRole, isAdmin, canManagePatients, canWriteRecords, login, logout, changePassword, ensureLoaded, refreshUser }
}
