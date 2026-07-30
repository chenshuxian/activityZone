import { expect, test } from 'vitest'
import { toRegistrationsCsv } from '@/lib/events/csv'
import type { RegistrationRow } from '@/lib/types'

const rows: RegistrationRow[] = [
  { userId:'u1', displayName:'小明', email:'a@x.com', status:'registered', partySize:2, formAnswers:{ phone:'0912' }, createdAt:'2026-07-30T00:00:00Z' },
]

test('空名單只有表頭', () => {
  const csv = toRegistrationsCsv([])
  expect(csv.split('\n')[0]).toContain('狀態')
  expect(csv.trim().split('\n').length).toBe(1)
})
test('輸出一列並正確跳脫逗號/引號', () => {
  const csv = toRegistrationsCsv([{ ...rows[0], displayName:'王, "小"明' }])
  const line = csv.trim().split('\n')[1]
  expect(line).toContain('"王, ""小""明"')
  expect(line).toContain('a@x.com')
  expect(line).toContain('2')
})
