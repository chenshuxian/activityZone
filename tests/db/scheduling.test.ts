import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUser(admin: SupabaseClient) {
  return (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!.id
}
async function makeEvent(admin: SupabaseClient, organizer: string, opts: { status?: string; startInHours?: number; endInHours?: number }) {
  const now = Date.now()
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: '排程測試活動', city: '台北市', district: '大安區',
    start_at: new Date(now + (opts.startInHours ?? 48) * 3600000).toISOString(),
    end_at: new Date(now + (opts.endInHours ?? 50) * 3600000).toISOString(),
    status: opts.status ?? 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('scheduling functions', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('expire_past_events：過期 published → ended，未過期不動', async () => {
    const org = await makeUser(admin)
    const past = await makeEvent(admin, org, { status: 'published', startInHours: -50, endInHours: -2 })
    const future = await makeEvent(admin, org, { status: 'published', startInHours: 48, endInHours: 50 })
    await admin.rpc('expire_past_events')
    const { data: p } = await admin.from('events').select('status').eq('id', past).single()
    const { data: f } = await admin.from('events').select('status').eq('id', future).single()
    expect(p!.status).toBe('ended')
    expect(f!.status).toBe('published')
  })

  test('notify_upcoming_events：24h 內活動的 registered 報名者收到一次 starting_soon', async () => {
    const org = await makeUser(admin)
    const soon = await makeEvent(admin, org, { status: 'published', startInHours: 12, endInHours: 14 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: soon, user_id: uid, status: 'registered' })
    await admin.rpc('notify_upcoming_events')
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('type').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(1)
  })

  test('notify_upcoming_events：>24h 的活動不發', async () => {
    const org = await makeUser(admin)
    const later = await makeEvent(admin, org, { status: 'published', startInHours: 48, endInHours: 50 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: later, user_id: uid, status: 'registered' })
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('id').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(0)
  })

  test('notify_upcoming_events：waitlist 報名者不發', async () => {
    const org = await makeUser(admin)
    const soon = await makeEvent(admin, org, { status: 'published', startInHours: 12, endInHours: 14 })
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: soon, user_id: uid, status: 'waitlist' })
    await admin.rpc('notify_upcoming_events')
    const { data } = await admin.from('notifications').select('id').eq('user_id', uid).eq('type', 'starting_soon')
    expect(data!.length).toBe(0)
  })
})
