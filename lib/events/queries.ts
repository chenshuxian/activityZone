import { createClient } from '@/lib/supabase/server'
import type { Category, EventSummary, EventDetail, EventFilters } from '@/lib/types'

interface EventRow {
  id: string
  title: string
  cover_image?: string | null
  city: string
  district: string
  start_at: string
  is_free: boolean
  capacity?: number | null
  event_categories?: { categories: Category }[] | null
  description?: string | null
  organizer_name?: string | null
  contact_info?: string | null
  fee_note?: string | null
  address?: string | null
  end_at: string
  registration_deadline?: string | null
  status?: EventDetail['status']
}

export function mapEventRow(row: EventRow): EventSummary {
  return {
    id: row.id,
    title: row.title,
    coverImage: row.cover_image ?? null,
    city: row.city,
    district: row.district,
    startAt: row.start_at,
    isFree: row.is_free,
    capacity: row.capacity ?? null,
    categories: (row.event_categories ?? []).map(ec => ec.categories),
  }
}

const SELECT = `
  id, title, cover_image, city, district, start_at, is_free, capacity,
  event_categories ( categories ( id, name, slug, icon ) )
`

export async function listPublishedEvents(filters: EventFilters = {}): Promise<EventSummary[]> {
  const supabase = await createClient()
  let q = supabase.from('events').select(SELECT)
    .eq('status', 'published')
    .gte('end_at', new Date().toISOString())
    .order('start_at', { ascending: true })
  if (filters.city) q = q.eq('city', filters.city)
  if (filters.district) q = q.eq('district', filters.district)
  if (filters.keyword) q = q.ilike('title', `%${filters.keyword}%`)
  const { data, error } = await q
  if (error) throw error
  let events = ((data ?? []) as unknown as EventRow[]).map(mapEventRow)
  if (filters.categorySlugs?.length) {
    events = events.filter(e =>
      e.categories.some(c => filters.categorySlugs!.includes(c.slug)))
  }
  return events
}

export async function getEventById(id: string): Promise<EventDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('events')
    .select(`${SELECT}, description, organizer_name, contact_info, fee_note,
             address, end_at, registration_deadline, status`)
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as EventRow
  return {
    ...mapEventRow(row),
    description: row.description ?? null,
    organizerName: row.organizer_name ?? null,
    contactInfo: row.contact_info ?? null,
    feeNote: row.fee_note ?? null,
    address: row.address ?? null,
    endAt: row.end_at,
    registrationDeadline: row.registration_deadline ?? null,
    status: row.status as EventDetail['status'],
  }
}
