import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function signedIn(admin: SupabaseClient) {
  const email = `u-${crypto.randomUUID()}@x.com`
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  const uid = (await c.auth.getUser()).data.user!.id
  return { client: c, uid }
}
async function makeEvent(admin: SupabaseClient, organizer: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizer, title: '收藏測試', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status: 'published',
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('favorites', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('本人可新增收藏並讀回', async () => {
    const { client, uid } = await signedIn(admin)
    const eventId = await makeEvent(admin, uid)
    const { error } = await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    expect(error).toBeNull()
    const { data } = await client.from('favorites').select('event_id')
    expect(data!.map(f => f.event_id)).toContain(eventId)
  })

  test('唯一約束避免重複收藏', async () => {
    const { client, uid } = await signedIn(admin)
    const eventId = await makeEvent(admin, uid)
    await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    const { error } = await client.from('favorites').insert({ user_id: uid, event_id: eventId })
    expect(error).not.toBeNull()
  })

  test('RLS：讀不到他人的收藏', async () => {
    const a = await signedIn(admin)
    const eventId = await makeEvent(admin, a.uid)
    await a.client.from('favorites').insert({ user_id: a.uid, event_id: eventId })
    const b = await signedIn(admin)
    const { data } = await b.client.from('favorites').select('id').eq('user_id', a.uid)
    expect(data).toEqual([])
  })
})
