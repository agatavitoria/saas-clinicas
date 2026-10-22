import type { ClinicDetails } from '~/types/clinic'

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * Clínica do usuário logado, compartilhada entre o layout do painel e as
 * páginas. Durante a carência da exclusão a clínica fica somente leitura.
 */
export function useClinic() {
  const api = useApi()
  const clinic = useState<ClinicDetails | null>('clinic:current', () => null)
  const { setBranding } = useBranding()

  async function refresh(): Promise<ClinicDetails | null> {
    try {
      clinic.value = await api<ClinicDetails>('/clinics/me')
      setBranding(clinic.value.id, clinic.value.branding)
    }
    catch {
      clinic.value = null
    }
    return clinic.value
  }

  async function ensureLoaded(): Promise<ClinicDetails | null> {
    return clinic.value ?? refresh()
  }

  async function cancelDeletion(): Promise<void> {
    clinic.value = await api<ClinicDetails>('/clinics/me/deletion-request', { method: 'DELETE' })
  }

  const readOnly = computed(() => clinic.value?.deletion.status === 'SCHEDULED')

  /** Dias até a exclusão definitiva (0 = hoje). */
  const daysUntilDeletion = computed(() => {
    const scheduledFor = clinic.value?.deletion.scheduledFor
    if (!scheduledFor) return null
    return Math.max(0, Math.ceil((new Date(scheduledFor).getTime() - Date.now()) / DAY_IN_MS))
  })

  return { clinic, readOnly, daysUntilDeletion, refresh, ensureLoaded, cancelDeletion }
}
