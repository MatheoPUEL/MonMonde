export function artworkInitials(title: string): string {
  return (
    title
      .split(' ')
      .filter(w => w.length > 2)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || title.slice(0, 2).toUpperCase()
  )
}
