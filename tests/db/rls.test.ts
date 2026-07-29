import { createClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('RLS', () => {
  test('匿名者讀不到 pending 活動', async () => {
    const admin = createClient(url!, service!)
    // profiles.id references auth.users(id), so a real auth user must exist
    // first (service_role's admin API bypasses email confirmation etc.)
    const { data: userData, error: uErr } = await admin.auth.admin.createUser({
      email: `seed-${crypto.randomUUID()}@example.com`,
      email_confirm: true,
    })
    expect(uErr).toBeNull()
    const uid = userData!.user!.id
    // service_role bypasses RLS; create a profile then a pending event
    const { error: pErr } = await admin.from('profiles').insert({ id: uid, display_name: 'seed-user' })
    expect(pErr).toBeNull()
    const title = 'hidden-' + uid
    const { error: eErr } = await admin.from('events').insert({
      organizer_id: uid, title, city: '台北市', district: '大安區',
      start_at: new Date(Date.now() + 86400000).toISOString(),
      end_at: new Date(Date.now() + 90000000).toISOString(),
      status: 'pending',
    })
    expect(eErr).toBeNull()

    const anonClient = createClient(url!, anon!)
    const { data } = await anonClient.from('events').select('id').eq('title', title)
    expect(data).toEqual([]) // RLS blocks it

    // also assert anon CAN read a published one
    const title2 = 'shown-' + uid
    await admin.from('events').insert({
      organizer_id: uid, title: title2, city: '台北市', district: '大安區',
      start_at: new Date(Date.now() + 86400000).toISOString(),
      end_at: new Date(Date.now() + 90000000).toISOString(),
      status: 'published',
    })
    const { data: shown } = await anonClient.from('events').select('id').eq('title', title2)
    expect(shown?.length).toBe(1)
  })
})
