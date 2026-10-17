/** Cliente HTTP para o backend, com a URL base vinda do runtimeConfig. */
export function useApi() {
  const config = useRuntimeConfig()
  return $fetch.create({ baseURL: config.public.apiBase })
}
