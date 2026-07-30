import type { EventStatus } from '@/lib/types'

const LABELS: Record<EventStatus, string> = {
  draft: '草稿', pending: '待審核', published: '已上架', rejected: '退回', ended: '已結束',
}
const TONE: Record<EventStatus, string> = {
  draft: 'bg-chip text-secondary',
  pending: 'bg-chip text-foreground',
  published: 'bg-accent text-on-accent',
  rejected: 'bg-chip text-red-600',
  ended: 'bg-chip text-secondary',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`inline-block rounded-pill px-2.5 py-0.5 text-xs ${TONE[status]}`}>
      {LABELS[status]}
    </span>
  )
}
