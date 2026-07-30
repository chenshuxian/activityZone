import { createClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('registrations RLS', () => {
  test('會員看不到他人活動的報名者', async () => {
    const admin = createClient(url!, service!)
    const a = (await admin.auth.admin.createUser({ email: `a-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    const { data: ev } = await admin.from('events').insert({
      organizer_id: a.id, title: 'evt', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
    }).select('id').single()
    const b = (await admin.auth.admin.createUser({ email: `b-${crypto.randomUUID()}@x.com`, password: 'pw', email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: ev!.id, user_id: b.id, status: 'registered' })

    const cEmail = `c-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email: cEmail, password: 'pw', email_confirm: true })
    const cClient = createClient(url!, anon!)
    await cClient.auth.signInWithPassword({ email: cEmail, password: 'pw' })
    const { data } = await cClient.from('registrations').select('id').eq('event_id', ev!.id)
    expect(data).toEqual([])
  })
})
