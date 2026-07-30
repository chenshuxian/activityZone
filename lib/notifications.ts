'use server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationItem, NotificationPayload, NotificationType } from '@/lib/types'

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('notifications')
    .select('id, type, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as NotificationType,
    payload: (n.payload ?? {}) as unknown as NotificationPayload,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function markRead(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function markAllRead(): Promise<void> {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}
