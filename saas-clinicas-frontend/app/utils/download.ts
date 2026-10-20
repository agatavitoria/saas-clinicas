/** Baixa um objeto como arquivo .json no navegador. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const exportFilename = (clinicName: string) => {
  const slug = clinicName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `${slug || 'clinica'}-dados-${new Date().toISOString().slice(0, 10)}.json`
}

export const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR')
