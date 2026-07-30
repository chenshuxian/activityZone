import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('registration reads', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('計數 view 反映 registered 數；匿名可讀', async () => {
    const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published', capacity: 5,
    }).select('id').single()
    const u = (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: u.id, status: 'registered' })

    const anonClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await anonClient.from('event_registered_counts')
      .select('registered_count').eq('event_id', ev!.id).single()
    expect(data!.registered_count).toBe(1)
  })

  test('get_my_registration 回傳本人狀態與候補序位', async () => {
    const organizer = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: organizer.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published', capacity: 1,
    }).select('id').single()
    const email = `w-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
    const filler = (await admin.auth.admin.createUser({ email: `f-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: filler.id, status: 'registered' })
    const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    await c.auth.signInWithPassword({ email, password: 'pw' })
    await c.rpc('register_for_event', { p_event_id: ev!.id })
    const { data } = await c.rpc('get_my_registration', { p_event_id: ev!.id })
    expect(data![0].status).toBe('waitlist')
    expect(data![0].waitlist_position).toBe(1)
  })
})
