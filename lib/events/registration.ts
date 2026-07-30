'use server'
import { createClient } from '@/lib/supabase/server'

export async function register(
  eventId: string,
  input: { partySize?: number; formAnswers?: Record<string, string> },
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_party_size: input.partySize ?? 1,
    p_form_answers: input.formAnswers ?? {},
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, status: data as 'registered' | 'waitlist' }
}

export async function cancelRegistration(eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancel_registration', { p_event_id: eventId })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, promotedUserId: (data as string | null) ?? null }
}
