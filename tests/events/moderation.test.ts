import { expect, test } from 'vitest'
import { nextStatusOnApprove, nextStatusOnReject } from '@/lib/events/mutations'

test('核准 pending → published', () => {
  expect(nextStatusOnApprove('pending')).toBe('published')
})
test('核准非 pending 應拒絕', () => {
  expect(() => nextStatusOnApprove('draft')).toThrow()
})
test('退回 pending → rejected', () => {
  expect(nextStatusOnReject('pending')).toBe('rejected')
})
