import { vi } from 'vitest'
vi.mock('@/lib/favorites', () => ({ toggleFavorite: vi.fn().mockResolvedValue({ ok: true, favorited: true }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }))
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EventCard } from '@/components/EventCard'
import type { EventSummary } from '@/lib/types'

const base: EventSummary = {
  id: 'e1', title: '晨跑', coverImage: null, city: '台北市', district: '大安區',
  startAt: '2026-08-01T00:00:00Z', isFree: true, capacity: null, registeredCount: 0, categories: [],
}

test('有封面顯示 img', () => {
  render(<EventCard event={{ ...base, coverImage: 'http://x/c.png' }} />)
  expect(screen.getByAltText('晨跑')).toBeInTheDocument()
})
test('無封面不顯示 img', () => {
  render(<EventCard event={base} />)
  expect(screen.queryByAltText('晨跑')).toBeNull()
})
