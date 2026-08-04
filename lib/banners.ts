'use server'
import { createClient } from '@/lib/supabase/server'
import { mergeBanners } from '@/lib/banners-logic'
import type { BannerItem } from '@/lib/types'

type EventRow = { id: string; title: string; city: string; district: string; start_at: string; status?: string; end_at?: string; cover_image?: string | null }
const toItem = (e: EventRow): BannerItem => ({ eventId: e.id, title: e.title, city: e.city, district: e.district, startAt: e.start_at, coverImage: e.cover_image ?? null })

export async function getHomeBanners(limit = 5): Promise<BannerItem[]> {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const { data: manualRows } = await supabase.from('banners')
    .select('sort_order, events!inner(id, title, city, district, start_at, status, end_at, cover_image)')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  const manual = ((manualRows ?? []) as unknown as { events: EventRow }[])
    .map(r => r.events)
    .filter(e => e.status === 'published' && (e.end_at ?? '') >= nowIso)
    .map(toItem)

  let auto: BannerItem[] = []
  if (manual.length < limit) {
    const { data: autoRows } = await supabase.from('events')
      .select('id, title, city, district, start_at, cover_image')
      .eq('status', 'published')
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(limit)
    auto = ((autoRows ?? []) as unknown as EventRow[]).map(toItem)
  }
  return mergeBanners(manual, auto, limit)
}

export interface ManualBanner { id: string; eventId: string; title: string; sortOrder: number; active: boolean }

export async function listManualBanners(): Promise<ManualBanner[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('banners')
    .select('id, event_id, sort_order, active, events!inner(title)')
    .order('sort_order', { ascending: true })
  return ((data ?? []) as unknown as { id: string; event_id: string; sort_order: number; active: boolean; events: { title: string } }[])
    .map(r => ({ id: r.id, eventId: r.event_id, title: r.events.title, sortOrder: r.sort_order, active: r.active }))
}

export async function addBanner(eventId: string) {
  const supabase = await createClient()
  const { data: max } = await supabase.from('banners').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const next = (max?.sort_order ?? 0) + 1
  const { error } = await supabase.from('banners').insert({ event_id: eventId, sort_order: next })
  return { ok: !error, error: error?.message }
}

export async function removeBanner(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('banners').delete().eq('id', id)
  return { ok: !error }
}

export async function reorderBanner(id: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: all } = await supabase.from('banners').select('id, sort_order').order('sort_order', { ascending: true })
  const list = all ?? []
  const idx = list.findIndex(b => b.id === id)
  if (idx < 0) return { ok: false }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= list.length) return { ok: false }
  const a = list[idx], b = list[swapIdx]
  await supabase.from('banners').update({ sort_order: b.sort_order }).eq('id', a.id)
  await supabase.from('banners').update({ sort_order: a.sort_order }).eq('id', b.id)
  return { ok: true }
}
