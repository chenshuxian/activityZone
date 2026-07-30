import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

async function makeUser(admin: SupabaseClient) {
  const u = (await admin.auth.admin.createUser({ email: `u-${crypto.randomUUID()}@x.com`, email_confirm: true })).data.user!
  return u.id
}
async function makeAdminClient(admin: SupabaseClient) {
  const email = `a-${crypto.randomUUID()}@x.com`
  const u = (await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })).data.user!
  await admin.from('profiles').update({ role: 'admin' }).eq('id', u.id)
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: 'pw' })
  return { client: c, id: u.id }
}
async function makeEvent(admin: SupabaseClient, organizerId: string, status: string) {
  const { data } = await admin.from('events').insert({
    organizer_id: organizerId, title: '通知測試活動', city: '台北市', district: '大安區',
    start_at: new Date(Date.now()+86400000).toISOString(),
    end_at: new Date(Date.now()+90000000).toISOString(), status,
  }).select('id').single()
  return data!.id as string
}

describe.skipIf(!url || !anon || !service)('notifications triggers', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('報名 registered → 產生 registered 通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: eventId, user_id: uid, status: 'registered' })
    const { data } = await admin.from('notifications').select('type, payload').eq('user_id', uid)
    expect(data!.length).toBe(1)
    expect(data![0].type).toBe('registered')
    expect((data![0].payload as { eventTitle: string }).eventTitle).toBe('通知測試活動')
  })

  test('候補遞補：waitlist→registered → promoted 通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    const { data: reg } = await admin.from('registrations')
      .insert({ event_id: eventId, user_id: uid, status: 'waitlist' }).select('id').single()
    await admin.from('registrations').update({ status: 'registered' }).eq('id', reg!.id)
    const { data } = await admin.from('notifications').select('type').eq('user_id', uid).order('created_at')
    expect(data!.map(d => d.type)).toEqual(['waitlisted', 'promoted'])
  })

  test('審核通過 → 主辦方收到 moderation_approved（需 admin 更新狀態）', async () => {
    const { client: adminClient } = await makeAdminClient(admin)
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'pending')
    await adminClient.from('events').update({ status: 'published' }).eq('id', eventId)
    const { data } = await admin.from('notifications').select('type').eq('user_id', organizer)
    expect(data!.map(d => d.type)).toContain('moderation_approved')
  })

  test('退回 → 主辦方收到 moderation_rejected 含原因', async () => {
    const { client: adminClient } = await makeAdminClient(admin)
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'pending')
    await adminClient.from('events').update({ status: 'rejected', reject_reason: '資訊不足' }).eq('id', eventId)
    const { data } = await admin.from('notifications').select('type, payload').eq('user_id', organizer)
    const rej = data!.find(d => d.type === 'moderation_rejected')
    expect(rej).toBeTruthy()
    expect((rej!.payload as { reason: string }).reason).toBe('資訊不足')
  })

  test('RLS：使用者只讀得到自己的通知', async () => {
    const organizer = await makeUser(admin)
    const eventId = await makeEvent(admin, organizer, 'published')
    const uid = await makeUser(admin)
    await admin.from('registrations').insert({ event_id: eventId, user_id: uid, status: 'registered' })
    const email = `o-${crypto.randomUUID()}@x.com`
    await admin.auth.admin.createUser({ email, password: 'pw', email_confirm: true })
    const other = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    await other.auth.signInWithPassword({ email, password: 'pw' })
    const { data } = await other.from('notifications').select('id').eq('user_id', uid)
    expect(data).toEqual([])
  })
})
