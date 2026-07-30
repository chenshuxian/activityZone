import type { NotificationType, NotificationPayload } from '@/lib/types'

export function notificationMessage(type: NotificationType, payload: NotificationPayload): string {
  const t = payload.eventTitle
  switch (type) {
    case 'registered': return `報名成功：${t}`
    case 'waitlisted': return `已加入候補：${t}`
    case 'promoted': return `候補遞補成功：${t}`
    case 'moderation_approved': return `活動已通過審核：${t}`
    case 'moderation_rejected': return `活動被退回：${t}${payload.reason ? `（${payload.reason}）` : ''}`
  }
}
