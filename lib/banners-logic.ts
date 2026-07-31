import type { BannerItem } from '@/lib/types'

export function mergeBanners(manual: BannerItem[], auto: BannerItem[], limit: number): BannerItem[] {
  const seen = new Set(manual.map(b => b.eventId))
  const result = [...manual]
  for (const item of auto) {
    if (result.length >= limit) break
    if (seen.has(item.eventId)) continue
    seen.add(item.eventId)
    result.push(item)
  }
  return result.slice(0, limit)
}
