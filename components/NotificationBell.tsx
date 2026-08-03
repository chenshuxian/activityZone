'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { getNotifications, getUnreadCount, markRead, markAllRead } from '@/lib/notifications'
import { notificationMessage } from '@/lib/notifications-logic'
import type { NotificationItem } from '@/lib/types'

export function NotificationBellView(props: {
  items: NotificationItem[]
  unread: number
  open: boolean
  onOpen: () => void
  onItemClick: (n: NotificationItem) => void
  onMarkAll: () => void
}) {
  const { items, unread, open, onOpen, onItemClick, onMarkAll } = props
  return (
    <div className="relative">
      <button onClick={onOpen} className="relative cursor-pointer text-lg" aria-label="通知">
        <Bell size={20} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold text-on-accent">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 overflow-hidden rounded-card border border-hairline bg-card shadow-card-hover">
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <span className="text-sm font-medium">通知</span>
            <button onClick={onMarkAll} className="cursor-pointer text-xs text-accent">全部標為已讀</button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-secondary">目前沒有通知</li>}
            {items.map(n => (
              <li key={n.id}
                onClick={() => onItemClick(n)}
                className={`cursor-pointer border-b border-hairline px-3 py-2 text-sm last:border-b-0 hover:bg-surface ${n.readAt ? 'text-secondary' : 'font-medium'}`}>
                {notificationMessage(n.type, n.payload)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  async function refresh() {
    const [list, count] = await Promise.all([getNotifications(), getUnreadCount()])
    setItems(list); setUnread(count)
  }
  useEffect(() => { refresh() }, [])

  const onOpen = () => {
    const next = !open
    setOpen(next)
    if (next) refresh()
  }
  const onItemClick = async (n: NotificationItem) => {
    await markRead(n.id)
    setOpen(false)
    router.push(`/events/${n.payload.eventId}`)
  }
  const onMarkAll = async () => { await markAllRead(); await refresh() }

  return (
    <NotificationBellView items={items} unread={unread} open={open}
      onOpen={onOpen} onItemClick={onItemClick} onMarkAll={onMarkAll} />
  )
}
