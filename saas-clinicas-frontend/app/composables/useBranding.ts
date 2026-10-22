import type { ClinicBranding } from '~/types/clinic'

const STORAGE_KEY = 'clinic-branding'

interface CachedBranding {
  tenantId: string
  branding: ClinicBranding | null
}

/**
 * Última identidade visual vista neste navegador. Aplicada antes de a API
 * responder, para a tela não "piscar" com a cor padrão. Só vale para a
 * mesma clínica.
 */
function readCache(tenantId: string | undefined): ClinicBranding | null {
  if (!import.meta.client || !tenantId) return null
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedBranding | null
    return cached?.tenantId === tenantId ? cached.branding : null
  }
  catch {
    return null
  }
}

function writeCache(value: CachedBranding): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }
  catch {
    // Sem armazenamento (ex.: navegação privada): só perde o cache
  }
}

/** Endereço do logo; o `v` muda a cada troca e invalida o cache da imagem. */
export const logoUrl = (path: string, branding: ClinicBranding | null | undefined) =>
  branding?.logoUpdatedAt ? `/api${path}?v=${Date.parse(branding.logoUpdatedAt)}` : null

/**
 * Identidade visual da clínica logada. Vem do /auth/me e do /clinics/me, e
 * o layout do painel aplica a cor no tema.
 */
export function useBranding() {
  const user = useAuthUser()
  const branding = useState<ClinicBranding | null>(
    'clinic:branding',
    () => readCache(user.value?.tenantId),
  )

  function setBranding(tenantId: string, value: ClinicBranding | null): void {
    branding.value = value
    writeCache({ tenantId, branding: value })
  }

  /** Troca de conta: começa pelo que estiver em cache para a nova clínica. */
  function resetBranding(tenantId: string | undefined): void {
    branding.value = readCache(tenantId)
  }

  const primaryColor = computed(() => branding.value?.primaryColor ?? DEFAULT_PRIMARY_COLOR)
  const clinicLogoUrl = computed(() => logoUrl('/clinics/me/logo', branding.value))

  return { branding, primaryColor, clinicLogoUrl, setBranding, resetBranding }
}
