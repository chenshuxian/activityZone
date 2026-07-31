'use server'

import { createClient } from '@/lib/supabase/server'
import { mapEventRow } from '@/lib/events/queries'
import type { EventSummary } from '@/lib/types'

export async function toggleFavorite(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  const { data: existing } = await supabase.from('favorites')
    .select('id').eq('user_id', user.id).eq('event_id', eventId).maybeSingle()

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id)
    return { ok: true as const, favorited: false }
  }
  await supabase.from('favorites').insert({ user_id: user.id, event_id: eventId })
  return { ok: true as const, favorited: true }
}

export async function getMyFavoriteEventIds(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('favorites').select('event_id').eq('user_id', user.id)
  return (data ?? []).map(f => f.event_id)
}

const SELECT = `
  id, title, cover_image, city, district, start_at, is_free, capacity,
  event_categories ( categories ( id, name, slug, icon ) )
`

export async function getMyFavorites(): Promise<EventSummary[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: favs } = await supabase.from('favorites')
    .select('event_id').eq('user_id', user.id).order('created_at', { ascending: false })
  const ids = (favs ?? []).map(f => f.event_id)
  if (ids.length === 0) return []

  const { data: events } = await supabase.from('events').select(SELECT).in('id', ids)
  const rows = events ?? []
  const order = new Map(ids.map((id, i) => [id, i]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  const { data: counts } = await supabase.from('event_registered_counts')
    .select('event_id, registered_count').in('event_id', ids)
  const countMap = new Map((counts ?? []).map(c => [c.event_id, c.registered_count ?? 0]))

  return rows.map(r => ({ ...mapEventRow(r), registeredCount: countMap.get(r.id) ?? 0 }))
}
