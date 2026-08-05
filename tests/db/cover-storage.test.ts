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
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

describe.skipIf(!url || !anon || !service)('cover storage RLS', () => {
  let admin: SupabaseClient
  beforeEach(() => { admin = createClient(url!, service!) })

  test('可上傳到自己資料夾並經 public URL 讀回', async () => {
    const { client, uid } = await signedIn(admin)
    const path = `${uid}/${crypto.randomUUID()}.png`
    const { error } = await client.storage.from('event-covers').upload(path, png(), { contentType: 'image/png' })
    expect(error).toBeNull()
    const publicUrl = client.storage.from('event-covers').getPublicUrl(path).data.publicUrl
    const res = await fetch(publicUrl)
    expect(res.status).toBe(200)
  })

  test('不能上傳到他人資料夾', async () => {
    const { client } = await signedIn(admin)
    const other = crypto.randomUUID()
    const { error } = await client.storage.from('event-covers').upload(`${other}/x.png`, png(), { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
})
