import type { EventSummary } from '@/lib/types'

export function EventCard({ event }: { event: EventSummary }) {
  const date = new Date(event.startAt).toLocaleDateString('zh-TW')
  return (
    <a href={`/events/${event.id}`} className="block border rounded-lg overflow-hidden">
      <div className="h-24 bg-gray-200" />
      <div className="p-2">
        <div className="font-semibold text-sm">{event.title}</div>
        <div className="text-xs text-gray-500">
          {date} · {event.city}{event.district}
        </div>
        <div className="text-xs text-gray-500">
          {event.categories.map(c => c.name).join('・')}
          {event.isFree ? '・免費' : ''}
        </div>
      </div>
    </a>
  )
}
