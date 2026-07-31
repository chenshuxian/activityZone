import { expect, test } from 'vitest'
import { mergeBanners } from '@/lib/banners-logic'
import type { BannerItem } from '@/lib/types'

const b = (id: string): BannerItem => ({ eventId: id, title: id, city: '台北市', district: '大安區', startAt: '2026-08-01T00:00:00Z' })

test('手動優先、自動補足、去重、截斷', () => {
  const manual = [b('m1'), b('m2')]
  const auto = [b('m2'), b('a1'), b('a2'), b('a3')]
  const r = mergeBanners(manual, auto, 4)
  expect(r.map(x => x.eventId)).toEqual(['m1', 'm2', 'a1', 'a2'])
})
test('手動已達上限則不補', () => {
  const r = mergeBanners([b('m1'), b('m2')], [b('a1')], 2)
  expect(r.map(x => x.eventId)).toEqual(['m1', 'm2'])
})
