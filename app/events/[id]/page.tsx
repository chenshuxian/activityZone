import { getEventById } from '@/lib/events/queries'
import { notFound } from 'next/navigation'
import { Chip } from '@/components/ui/Chip'

export default async function EventDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getEventById(id)
  if (!ev || ev.status !== 'published') notFound()
  const maps = ev.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`
    : null
  const fmt = (d: string) =>
    new Date(d).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <main>
      <div className="h-56 w-full bg-gradient-to-br from-[#a8c0ff] to-[#3f6cd8]" />
      <article className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ev.categories.map(c => <Chip key={c.id}>{c.name}</Chip>)}
          {ev.isFree ? <Chip tone="accent">免費</Chip> : ev.feeNote && <Chip>{ev.feeNote}</Chip>}
        </div>
        <h1 className="text-3xl font-black tracking-hero">{ev.title}</h1>

        <dl className="mt-6 space-y-3 text-[15px]">
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-secondary">時間</dt>
            <dd>{fmt(ev.startAt)} — {fmt(ev.endAt)}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-secondary">地點</dt>
            <dd>
              {ev.city}{ev.district} {ev.address}
              {maps && (
                <a href={maps} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent hover:underline">
                  在 Google Maps 開啟
                </a>
              )}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-secondary">主辦</dt>
            <dd>{ev.organizerName} · {ev.contactInfo}</dd>
          </div>
        </dl>

        {ev.description && (
          <div className="mt-8 whitespace-pre-wrap leading-relaxed text-foreground">
            {ev.description}
          </div>
        )}
      </article>
    </main>
  )
}
