import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventForEdit } from '@/lib/events/dashboard'
import { updateEvent } from '@/lib/events/actions'
import { EventForm } from '@/components/EventForm'
import type { EventInput } from '@/lib/events/mutations'
import { taipeiInputValue } from '@/lib/time'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const ev = await getEventForEdit(id)
  if (!ev) notFound()

  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')

  async function submit(input: EventInput) {
    'use server'
    return updateEvent(id, input)
  }

  const registrationFields = (ev.registration_fields ?? {}) as {
    party_size?: string
    phone?: string
    note?: string
  }

  const initial = {
    id,
    title: ev.title,
    description: ev.description ?? '',
    city: ev.city,
    district: ev.district,
    address: ev.address ?? '',
    startAt: taipeiInputValue(ev.start_at),
    endAt: taipeiInputValue(ev.end_at),
    capacity: ev.capacity,
    isFree: ev.is_free,
    organizerName: ev.organizer_name ?? '',
    contactInfo: ev.contact_info ?? '',
    categoryIds: (ev.event_categories ?? []).map((c: { category_id: string }) => c.category_id),
    registrationOpen: ev.registration_open ?? true,
    registrationFields,
    coverImage: ev.cover_image ?? '',
    coverPosition: ev.cover_position ?? 50,
  }
  return (
    <main>
      <EventForm categories={categories ?? []} initial={initial} submitAction={submit} submitLabel="儲存變更" />
    </main>
  )
}
