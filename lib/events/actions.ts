'use server'
import { createClient } from '@/lib/supabase/server'
import { validateEventInput, nextStatusOnApprove, nextStatusOnReject, type EventInput } from '@/lib/events/mutations'
import type { EventStatus } from '@/lib/types'
import type { Database } from '@/lib/database.types'

type EventInsert = Database['public']['Tables']['events']['Insert']
type EventUpdate = Database['public']['Tables']['events']['Update']

export async function createEvent(input: EventInput) {
  const errors = validateEventInput(input)
  if (errors.length) return { ok: false as const, errors }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, errors: ['請先登入'] }

  // 管理員發布的活動免審核，直接上架
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = me?.role === 'admin'

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
    status: isAdmin ? 'published' : 'pending',
    registration_open: input.registrationOpen ?? true,
    registration_fields: input.registrationFields ?? {},
    cover_image: input.coverImage ?? null,
    cover_position: input.coverPosition ?? 50,
  }

  const { data, error } = await supabase.from('events').insert(insert).select('id').single()
  if (error) return { ok: false as const, errors: [error.message] }

  if (input.categoryIds.length) {
    await supabase.from('event_categories').insert(
      input.categoryIds.map(cid => ({ event_id: data.id, category_id: cid })))
  }
  return { ok: true as const, id: data.id }
}

export async function updateEvent(eventId: string, input: EventInput) {
  const errors = validateEventInput(input)
  if (errors.length) return { ok: false as const, errors }
  const supabase = await createClient()

  const update: EventUpdate = {
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
    registration_open: input.registrationOpen ?? true,
    registration_fields: input.registrationFields ?? {},
    cover_image: input.coverImage ?? null,
    cover_position: input.coverPosition ?? 50,
  }

  const { error } = await supabase.from('events').update(update).eq('id', eventId)
  if (error) return { ok: false as const, errors: [error.message] }

  await supabase.from('event_categories').delete().eq('event_id', eventId)
  if (input.categoryIds.length) {
    await supabase.from('event_categories').insert(
      input.categoryIds.map(cid => ({ event_id: eventId, category_id: cid })))
  }
  return { ok: true as const }
}

export async function deleteEvent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('events').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function approveEvent(id: string) {
  const supabase = await createClient()
  const { data: cur, error: curError } = await supabase.from('events').select('status').eq('id', id).single()
  if (curError || !cur) return { ok: false, error: curError?.message ?? '活動不存在' }
  // `status` is `text` + CHECK in Postgres, not a native enum, so the
  // generated column type is the widened `string`; the CHECK constraint
  // guarantees the runtime value is one of EventStatus.
  const next = nextStatusOnApprove(cur.status as EventStatus)
  const { error } = await supabase.from('events').update({ status: next }).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function rejectEvent(id: string, reason: string) {
  const supabase = await createClient()
  const { data: cur, error: curError } = await supabase.from('events').select('status').eq('id', id).single()
  if (curError || !cur) return { ok: false, error: curError?.message ?? '活動不存在' }
  const next = nextStatusOnReject(cur.status as EventStatus)
  const { error } = await supabase.from('events')
    .update({ status: next, reject_reason: reason }).eq('id', id)
  return { ok: !error, error: error?.message }
}
