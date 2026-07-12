interface TiptapNode {
  type: string
  text?: string
  content?: TiptapNode[]
}

function extractText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  return node.content.map(extractText).join(' ')
}

export function extractTextFromTiptap(jsonString: string): string {
  try {
    const doc = JSON.parse(jsonString) as TiptapNode
    return extractText(doc).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}
