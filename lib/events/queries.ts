import { createClient } from '@/lib/supabase/server'
import type { EventSummary, EventDetail, EventFilters, MyRegistration } from '@/lib/types'
import type { Database } from '@/lib/database.types'

type EventRow = Database['public']['Tables']['events']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']

// Shape of a row returned by the SELECT below: the summary columns plus the
// nested event_categories -> categories join. supabase-js parses the SELECT
// string literal at compile time, so query results already infer this shape;
// this alias just gives `mapEventRow`'s parameter a name to document it.
type EventWithCategories = Pick<
  EventRow,
  'id' | 'title' | 'cover_image' | 'city' | 'district' | 'start_at' | 'is_free' | 'capacity'
> & {
  event_categories: { categories: Pick<CategoryRow, 'id' | 'name' | 'slug' | 'icon'> }[]
}

export function mapEventRow(row: EventWithCategories): EventSummary {
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
    registeredCount: 0,
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
  let events = (data ?? []).map(mapEventRow)
  if (filters.categorySlugs?.length) {
    events = events.filter(e =>
      e.categories.some(c => filters.categorySlugs!.includes(c.slug)))
  }

  const ids = events.map(e => e.id)
  const { data: counts } = ids.length
    ? await supabase.from('event_registered_counts').select('event_id, registered_count').in('event_id', ids)
    : { data: [] }
  const countMap = new Map((counts ?? []).map(c => [c.event_id, c.registered_count ?? 0]))
  return events.map(e => ({ ...e, registeredCount: countMap.get(e.id) ?? 0 }))
}

export async function getEventById(id: string): Promise<EventDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('events')
    .select(`${SELECT}, description, organizer_name, contact_info, fee_note,
             address, end_at, registration_deadline, registration_open, status`)
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null

  const [{ data: countRow }, { data: myReg }] = await Promise.all([
    supabase.from('event_registered_counts').select('registered_count').eq('event_id', id).maybeSingle(),
    supabase.rpc('get_my_registration', { p_event_id: id }),
  ])
  const registeredCount = countRow?.registered_count ?? 0
  const myRow = Array.isArray(myReg) ? myReg[0] : undefined
  const myRegistration: MyRegistration | null = myRow
    ? { status: myRow.status as MyRegistration['status'], waitlistPosition: myRow.waitlist_position ?? null }
    : null

  return {
    ...mapEventRow(data),
    description: data.description ?? null,
    organizerName: data.organizer_name ?? null,
    contactInfo: data.contact_info ?? null,
    feeNote: data.fee_note ?? null,
    address: data.address ?? null,
    endAt: data.end_at,
    registrationDeadline: data.registration_deadline ?? null,
    registrationOpen: data.registration_open ?? true,
    // `status` is a `text` column with a CHECK constraint in Postgres, not a
    // native enum, so the generated type is the widened `string` here. The
    // CHECK constraint guarantees the runtime value is one of EventStatus.
    status: data.status as EventDetail['status'],
    registeredCount,
    myRegistration,
  }
}
