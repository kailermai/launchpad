export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Unknown'
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

/** Deterministic gradient for cover-less entries so every card has a distinct tile. */
export function gradientFor(name: string): string {
  let hash = 2166136261
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619)
  // Golden-angle spacing keeps neighbouring names visually distinct.
  const hue = Math.round((Math.abs(hash) * 137.508) % 360)
  const hue2 = (hue + 40) % 360
  return `linear-gradient(160deg, hsl(${hue} 55% 34%), hsl(${hue2} 60% 18%))`
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export const LAUNCH_TYPE_LABEL: Record<'executable' | 'shortcut' | 'uri', string> = {
  executable: 'Executable',
  shortcut: 'Shortcut',
  uri: 'Link'
}
