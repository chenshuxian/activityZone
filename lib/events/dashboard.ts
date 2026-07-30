import { createClient } from '@/lib/supabase/server'
import type { DashboardEvent, EventStatus } from '@/lib/types'
import type { Database } from '@/lib/database.types'

type EventRow = Database['public']['Tables']['events']['Row']
type RegistrationRow = Database['public']['Tables']['registrations']['Row']

type DashboardEventRow = Pick<EventRow, 'id' | 'title' | 'status' | 'start_at' | 'capacity'>
type RegistrationCountRow = Pick<RegistrationRow, 'event_id' | 'status'>

export async function getMyEvents(): Promise<DashboardEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: events } = await supabase.from('events')
    .select('id, title, status, start_at, capacity')
    .eq('organizer_id', user.id)
    .order('start_at', { ascending: false })
  const list: DashboardEventRow[] = events ?? []
  const ids = list.map(e => e.id)

  const { data: regs } = ids.length
    ? await supabase.from('registrations').select('event_id, status').in('event_id', ids)
    : { data: [] as RegistrationCountRow[] }
  const reg: RegistrationCountRow[] = regs ?? []
  const count = (id: string, s: string) => reg.filter(r => r.event_id === id && r.status === s).length

  return list.map(e => ({
    id: e.id,
    title: e.title,
    // `status` is a `text` column with a CHECK constraint in Postgres, not a
    // native enum, so the generated type is the widened `string` here. The
    // CHECK constraint guarantees the runtime value is one of EventStatus.
    status: e.status as EventStatus,
    startAt: e.start_at,
    capacity: e.capacity ?? null,
    registeredCount: count(e.id, 'registered'),
    waitlistCount: count(e.id, 'waitlist'),
  }))
}

export async function getEventForEdit(eventId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('events')
    .select('*, event_categories(category_id)')
    .eq('id', eventId).maybeSingle()
  return data
}
