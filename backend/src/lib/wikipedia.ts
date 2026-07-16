export async function fetchWikipediaExtract(lang: string, title: string): Promise<string | undefined> {
  const res = await fetch(
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return undefined

  const data = await res.json() as { query?: { pages?: Record<string, { extract?: string }> } }
  const pages = data.query?.pages
  if (!pages) return undefined
  const page = Object.values(pages)[0]
  return page?.extract?.trim() || undefined
}
