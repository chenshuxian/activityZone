import { expect, test } from 'vitest'
import { mapEventRow } from '@/lib/events/queries'

test('mapEventRow 把 DB 欄位轉成 EventSummary', () => {
  const row = {
    id: 'e1', title: '晨跑', cover_image: null,
    city: '台北市', district: '大安區',
    start_at: '2026-07-29T00:00:00Z', is_free: true, capacity: 20,
    event_categories: [{ categories: { id: 'c1', name: '體育', slug: 'sports', icon: '🏃' } }],
  }
  const s = mapEventRow(row as any)
  expect(s.title).toBe('晨跑')
  expect(s.categories[0].slug).toBe('sports')
  expect(s.startAt).toBe('2026-07-29T00:00:00Z')
})
