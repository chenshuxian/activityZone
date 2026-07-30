import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { NotificationBellView } from '@/components/NotificationBell'
import type { NotificationItem } from '@/lib/types'

const items: NotificationItem[] = [
  { id: 'n1', type: 'registered', payload: { eventId: 'e1', eventTitle: '晨跑' }, readAt: null, createdAt: new Date().toISOString() },
]

test('未讀數徽章顯示', () => {
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={()=>{}} open={false} />)
  expect(screen.getByText('1')).toBeInTheDocument()
})
test('開啟面板列出通知訊息', () => {
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={()=>{}} open={true} />)
  expect(screen.getByText('報名成功：晨跑')).toBeInTheDocument()
})
test('點全部已讀觸發 callback', () => {
  const onMarkAll = vi.fn()
  render(<NotificationBellView items={items} unread={1} onOpen={()=>{}} onItemClick={()=>{}} onMarkAll={onMarkAll} open={true} />)
  fireEvent.click(screen.getByText('全部標為已讀'))
  expect(onMarkAll).toHaveBeenCalled()
})
