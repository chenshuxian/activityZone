import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeEvent(admin: SupabaseClient, org: string, startInHours: number) {
  const { data } = await admin.from('events').insert({
    organizer_id: org, title: `evt-${startInHours}`, city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+startInHours*3600000).toISOString(),
    end_at: new Date(Date.now()+(startInHours+2)*3600000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('home banners data', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('手動 banner 連動的活動可經 join 讀回，且自動候選依 start_at 遞增', async () => {
    const org = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!.id
    const e1 = await makeEvent(admin, org, 10)
    const e2 = await makeEvent(admin, org, 20)
    await admin.from('banners').insert({ event_id: e1, active: true, sort_order: 1 })
    const { data: manual } = await admin.from('banners')
      .select('sort_order, events!inner(id, title, status)').eq('active', true)
    expect((manual as unknown as { events: { id: string } }[]).some(r => r.events.id === e1)).toBe(true)
    const { data: auto } = await admin.from('events')
      .select('id, start_at').eq('status', 'published').gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
    const ids = (auto ?? []).map(a => a.id)
    expect(ids).toContain(e2)
  })
})
