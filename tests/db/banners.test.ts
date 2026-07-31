import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function adminClient(admin: SupabaseClient) {
  const email = `a-${crypto.randomUUID()}@x.com`
  const u = (await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })).data.user!
  await admin.from('profiles').update({ role: 'admin' }).eq('id', u.id)
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return { client: c, id: u.id }
}
async function memberClient(admin: SupabaseClient) {
  const email = `m-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}
async function makeEvent(admin: SupabaseClient, organizer: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: 'banner 測試', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('banners RLS', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('admin 可新增 banner，任何人可讀', async () => {
    const { client: a, id } = await adminClient(admin)
    const eventId = await makeEvent(admin, id)
    const { error } = await a.from('banners').insert({ event_id: eventId })
    expect(error).toBeNull()
    const anonClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await anonClient.from('banners').select('event_id').eq('event_id', eventId)
    expect(data!.length).toBe(1)
  })

  test('非 admin 不能新增 banner', async () => {
    const org = (await admin.auth.admin.createUser({ email: `o-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    const eventId = await makeEvent(admin, org.id)
    const m = await memberClient(admin)
    const { error } = await m.from('banners').insert({ event_id: eventId })
    expect(error).not.toBeNull()
  })
})
