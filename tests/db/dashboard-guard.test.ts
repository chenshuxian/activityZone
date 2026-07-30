import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function signedInClient(admin: SupabaseClient, email: string) {
  await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return c
}

describe.skipIf(!url || !anon || !service)('dashboard guard + registrations', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  async function ownerWithEvent(status: string) {
    const email = `own-${crypto.randomUUID()}@x.com`
    const client = await signedInClient(admin, email)
    const uid = (await client.auth.getUser()).data.user!.id
    const { data: ev } = await admin.from('events').insert({
      organizer_id: uid, title: 'orig', city: '台北市', district: '大安區',
      start_at: new Date(Date.now()+86400000).toISOString(),
      end_at: new Date(Date.now()+90000000).toISOString(), status,
    }).select('id').single()
    return { client, uid, eventId: ev!.id as string }
  }

  test('主辦方可編輯已上架活動的內容', async () => {
    const { client, eventId } = await ownerWithEvent('published')
    const { error } = await client.from('events').update({ title: '新標題' }).eq('id', eventId)
    expect(error).toBeNull()
    const { data } = await admin.from('events').select('title').eq('id', eventId).single()
    expect(data!.title).toBe('新標題')
  })

  test('主辦方不能改自己活動的 status', async () => {
    const { client, eventId } = await ownerWithEvent('pending')
    const { error } = await client.from('events').update({ status: 'published' }).eq('id', eventId)
    expect(error).not.toBeNull()
    const { data } = await admin.from('events').select('status').eq('id', eventId).single()
    expect(data!.status).toBe('pending')
  })

  test('主辦方可將 rejected 重新送審為 pending', async () => {
    const { client, eventId } = await ownerWithEvent('rejected')
    const { error } = await client.from('events').update({ status: 'pending' }).eq('id', eventId)
    expect(error).toBeNull()
  })

  test('名單函式：主辦方可取得（含 email、正取先於候補），非主辦方被拒', async () => {
    const { client, eventId } = await ownerWithEvent('published')
    const u1 = (await admin.auth.admin.createUser({ email: `r1-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    const u2 = (await admin.auth.admin.createUser({ email: `r2-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
    await admin.from('registrations').insert({ event_id: eventId, user_id: u1.id, status: 'registered' })
    await admin.from('registrations').insert({ event_id: eventId, user_id: u2.id, status: 'waitlist' })

    const { data, error } = await client.rpc('get_event_registrations', { p_event_id: eventId })
    expect(error).toBeNull()
    expect(data!.length).toBe(2)
    expect(data![0].status).toBe('registered')
    expect(String(data![0].email)).toContain('@')

    const outsider = await signedInClient(admin, `out-${crypto.randomUUID()}@x.com`)
    const denied = await outsider.rpc('get_event_registrations', { p_event_id: eventId })
    expect(denied.error).not.toBeNull()
  })
})
