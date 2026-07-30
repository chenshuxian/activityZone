import { createClient } from '@/lib/supabase/server'
import type { RegistrationRow } from '@/lib/types'
import type { Database } from '@/lib/database.types'

type RegistrationFunctionRow = Database['public']['Functions']['get_event_registrations']['Returns'][number]

export async function getEventRegistrations(eventId: string): Promise<RegistrationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_event_registrations', { p_event_id: eventId })
  if (error) throw error
  const rows: RegistrationFunctionRow[] = data ?? []
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name ?? null,
    email: r.email ?? null,
    status: r.status as 'registered' | 'waitlist',
    partySize: r.party_size,
    formAnswers: (r.form_answers ?? {}) as Record<string, string>,
    createdAt: r.created_at,
  }))
}
