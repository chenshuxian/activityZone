import { expect, test } from 'vitest'
import { parseRegistrationFields } from '@/lib/events/registration-logic'

test('預設全部 off 時無欄位', () => {
  expect(parseRegistrationFields({})).toEqual([])
})
test('解析 required / optional，忽略 off', () => {
  const fields = parseRegistrationFields({ party_size: 'optional', phone: 'required', note: 'off' })
  expect(fields).toEqual([
    { key: 'party_size', label: '同行人數', required: false },
    { key: 'phone', label: '聯絡電話', required: true },
  ])
})
