import { getEventById } from '@/lib/events/queries'
import { notFound } from 'next/navigation'

export default async function EventDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getEventById(id)
  if (!ev || ev.status !== 'published') notFound()
  const maps = ev.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`
    : null
  return (
    <main>
      <article className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold">{ev.title}</h1>
        <p className="text-gray-600">
          📅 {new Date(ev.startAt).toLocaleString('zh-TW')} — {new Date(ev.endAt).toLocaleString('zh-TW')}
        </p>
        <p className="text-gray-600">
          📍 {ev.city}{ev.district} {ev.address}
          {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="text-blue-600 ml-2">在 Google Maps 開啟</a>}
        </p>
        <p className="text-gray-600">🏷️ {ev.categories.map(c => c.name).join('・')} · {ev.isFree ? '免費' : ev.feeNote}</p>
        <p className="text-gray-600">主辦：{ev.organizerName} · {ev.contactInfo}</p>
        <div className="mt-4 whitespace-pre-wrap">{ev.description}</div>
      </article>
    </main>
  )
}
