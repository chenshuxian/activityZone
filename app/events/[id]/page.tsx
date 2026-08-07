import { getEventById } from '@/lib/events/queries'
import { notFound } from 'next/navigation'
import { Chip } from '@/components/ui/Chip'
import { RegistrationPanel } from '@/components/RegistrationPanel'
import { FavoriteButton } from '@/components/FavoriteButton'
import { parseRegistrationFields, type RegistrationFieldConfig } from '@/lib/events/registration-logic'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/time'
import { Linkify } from '@/components/Linkify'

export default async function EventDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = await getEventById(id)
  if (!ev || ev.status !== 'published') notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawEvent } = await supabase.from('events').select('registration_fields').eq('id', id).single()
  const fields = parseRegistrationFields((rawEvent?.registration_fields ?? {}) as RegistrationFieldConfig)
  const { data: fav } = user
    ? await supabase.from('favorites').select('id').eq('user_id', user.id).eq('event_id', id).maybeSingle()
    : { data: null }

  const maps = ev.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`
    : null
  const fmt = formatDateTime
  return (
    <main>
      <div className="flex h-[70vh] min-h-[400px] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#a8c0ff] to-[#3f6cd8]">
        {ev.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.coverImage} alt={ev.title} className="h-full w-full object-contain" />
        )}
      </div>
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

        <div className="my-6 space-y-3">
          <FavoriteButton eventId={ev.id} initialFavorited={Boolean(fav)} variant="inline" />
          {ev.registrationOpen && (
            <RegistrationPanel
              eventId={ev.id}
              capacity={ev.capacity}
              registeredCount={ev.registeredCount}
              fields={fields}
              startAt={ev.startAt}
              registrationDeadline={ev.registrationDeadline}
              isLoggedIn={Boolean(user)}
              myRegistration={ev.myRegistration}
            />
          )}
        </div>

        {ev.description && (
          <div className="mt-8 whitespace-pre-wrap leading-relaxed text-foreground">
            <Linkify text={ev.description} />
          </div>
        )}
      </article>
    </main>
  )
}
