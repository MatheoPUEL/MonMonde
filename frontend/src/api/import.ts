// frontend/src/api/import.ts
import { apiClient } from './client'

export interface ImportResult {
  imported: number
  skipped: number
  total: number
}

export type ImportableModule = 'journal' | 'reading' | 'routines' | 'citations'

export async function importModule(module: ImportableModule, data: object): Promise<ImportResult> {
  return apiClient<ImportResult>(`/api/import/${module}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function countItems(module: ImportableModule, data: Record<string, unknown>): number {
  const key: Record<ImportableModule, string> = {
    journal: 'entries',
    reading: 'books',
    routines: 'routines',
    citations: 'citations',
  }
  const arr = data[key[module]]
  return Array.isArray(arr) ? arr.length : 0
}
