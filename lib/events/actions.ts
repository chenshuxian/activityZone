'use server'
import { createClient } from '@/lib/supabase/server'
import { validateEventInput, type EventInput } from '@/lib/events/mutations'

interface EventInsert {
  organizer_id: string
  title: string
  description: string | null
  city: string
  district: string
  address: string | null
  start_at: string
  end_at: string
  is_free: boolean
  fee_note: string | null
  organizer_name: string | null
  contact_info: string | null
  capacity: number | null
  status: 'pending'
}

export async function createEvent(input: EventInput) {
  const errors = validateEventInput(input)
  if (errors.length) return { ok: false as const, errors }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, errors: ['請先登入'] }

  const insert: EventInsert = {
    organizer_id: user.id,
    title: input.title,
    description: input.description ?? null,
    city: input.city,
    district: input.district,
    address: input.address ?? null,
    start_at: input.startAt,
    end_at: input.endAt,
    is_free: input.isFree,
    fee_note: input.feeNote ?? null,
    organizer_name: input.organizerName ?? null,
    contact_info: input.contactInfo ?? null,
    capacity: input.capacity ?? null,
    status: 'pending',
  }

  const { data, error } = await supabase.from('events').insert(insert).select('id').single()
  if (error) return { ok: false as const, errors: [error.message] }

  if (input.categoryIds.length) {
    await supabase.from('event_categories').insert(
      input.categoryIds.map(cid => ({ event_id: data.id, category_id: cid })))
  }
  return { ok: true as const, id: data.id }
}
