// frontend/src/api/export.ts
import { apiClient } from './client'

const MODULES = ['journal', 'reading', 'routines', 'citations', 'all'] as const
type ExportModule = typeof MODULES[number]

export async function exportModule(module: ExportModule): Promise<void> {
  const data = await apiClient<object>(`/api/export/${module}`)
  const filename = module === 'all'
    ? `monmonde-${today()}.json`
    : `${module}-${today()}.json`
  download(data, filename)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function download(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
