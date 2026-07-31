import { expect, test } from 'vitest'
import { notificationMessage } from '@/lib/notifications-logic'

const p = { eventId: 'e1', eventTitle: '晨跑' }

test('各類型訊息', () => {
  expect(notificationMessage('registered', p)).toBe('報名成功：晨跑')
  expect(notificationMessage('waitlisted', p)).toBe('已加入候補：晨跑')
  expect(notificationMessage('promoted', p)).toBe('候補遞補成功：晨跑')
  expect(notificationMessage('moderation_approved', p)).toBe('活動已通過審核：晨跑')
})
test('退回含原因', () => {
  expect(notificationMessage('moderation_rejected', { ...p, reason: '資訊不足' }))
    .toBe('活動被退回：晨跑（資訊不足）')
})
test('退回無原因', () => {
  expect(notificationMessage('moderation_rejected', p)).toBe('活動被退回：晨跑')
})
test('即將開始訊息', () => {
  expect(notificationMessage('starting_soon', { eventId: 'e1', eventTitle: '晨跑' }))
    .toBe('活動即將開始：晨跑')
})
