import { expect, test } from 'vitest'
import { validateEventInput } from '@/lib/events/mutations'

test('缺標題時回錯誤', () => {
  const errors = validateEventInput({ title: '', city: '台北市', district: '大安區',
    startAt: '2026-08-01T10:00', endAt: '2026-08-01T12:00' } as any)
  expect(errors).toContain('請填寫活動標題')
})
test('結束早於開始時回錯誤', () => {
  const errors = validateEventInput({ title: 'x', city: '台北市', district: '大安區',
    startAt: '2026-08-01T12:00', endAt: '2026-08-01T10:00' } as any)
  expect(errors).toContain('結束時間不得早於開始時間')
})
test('合法輸入回空陣列', () => {
  const errors = validateEventInput({ title: 'x', city: '台北市', district: '大安區',
    startAt: '2026-08-01T10:00', endAt: '2026-08-01T12:00' } as any)
  expect(errors).toEqual([])
})
