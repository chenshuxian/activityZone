import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUserClient(admin: SupabaseClient) {
  const email = `u-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  // Each test user needs its own isolated session. supabase-js falls back to a
  // shared in-memory storage singleton when no window.localStorage is present
  // (as in this Node test environment), so concurrent clients created with
  // default options clobber each other's auth session under the same storage
  // key. Disabling persistence keeps each client's session independent.
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}
async function makeEvent(admin: SupabaseClient, capacity: number | null) {
  const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
  const { data } = await admin.from('events').insert({
    organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(),
    status: 'published', capacity,
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('registration RPC', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('未滿給 registered，滿了給 waitlist', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    const r1 = await u1.rpc('register_for_event', { p_event_id: eventId })
    const r2 = await u2.rpc('register_for_event', { p_event_id: eventId })
    expect(r1.data).toBe('registered')
    expect(r2.data).toBe('waitlist')
  })

  test('取消 registered → 最早候補遞補', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    await u1.rpc('register_for_event', { p_event_id: eventId })
    await u2.rpc('register_for_event', { p_event_id: eventId })
    const cancel = await u1.rpc('cancel_registration', { p_event_id: eventId })
    expect(cancel.data).not.toBeNull()
    const { data: u2reg } = await admin.from('registrations')
      .select('status').eq('event_id', eventId).eq('user_id', (await u2.auth.getUser()).data.user!.id).single()
    expect(u2reg!.status).toBe('registered')
  })

  test('重複報名被擋', async () => {
    const eventId = await makeEvent(admin, null)
    const u1 = await makeUserClient(admin)
    await u1.rpc('register_for_event', { p_event_id: eventId })
    const again = await u1.rpc('register_for_event', { p_event_id: eventId })
    expect(again.error).not.toBeNull()
  })

  test('併發搶最後一位：只有一位 registered', async () => {
    const eventId = await makeEvent(admin, 1)
    const u1 = await makeUserClient(admin)
    const u2 = await makeUserClient(admin)
    const [r1, r2] = await Promise.all([
      u1.rpc('register_for_event', { p_event_id: eventId }),
      u2.rpc('register_for_event', { p_event_id: eventId }),
    ])
    const results = [r1.data, r2.data].sort()
    expect(results).toEqual(['registered', 'waitlist'])
  })
})
