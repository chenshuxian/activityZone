import { createClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY
const service = process.env.SUPABASE_TEST_SERVICE_KEY

describe.skipIf(!url || !anon || !service)('RLS', () => {
  test('匿名者讀不到 pending 活動', async () => {
    const admin = createClient(url!, service!)
    // profiles.id references auth.users(id). Creating the auth user also
    // auto-creates its profiles row via the on_auth_user_created trigger
    // (migration 0004), so no manual profile insert is needed.
    const { data: userData, error: uErr } = await admin.auth.admin.createUser({
      email: `seed-${crypto.randomUUID()}@example.com`,
      email_confirm: true,
    })
    expect(uErr).toBeNull()
    const uid = userData!.user!.id
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

  test('非 admin 無法透過 API 直接上架活動（跳過審核）', async () => {
    const admin = createClient(url!, service!)

    // Create a real, confirmed auth user with a known password so we can
    // sign in as them via the anon-key client and exercise RLS as an
    // authenticated (but non-admin) user — not the RLS-bypassing service role.
    const email = `owner-${crypto.randomUUID()}@example.com`
    const password = 'test-password-123!'
    const { data: userData, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    expect(uErr).toBeNull()
    const uid = userData!.user!.id
    // profile auto-created by the on_auth_user_created trigger (migration 0004)

    const ownerClient = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: signInErr } = await ownerClient.auth.signInWithPassword({ email, password })
    expect(signInErr).toBeNull()

    // Attempting to insert directly as 'published' must be rejected by the
    // events_insert with-check (non-admin can only insert draft/pending).
    const publishTitle = 'bypass-publish-' + uid
    const { error: insertPublishedErr } = await ownerClient.from('events').insert({
      organizer_id: uid, title: publishTitle, city: '台北市', district: '大安區',
      start_at: new Date(Date.now() + 86400000).toISOString(),
      end_at: new Date(Date.now() + 90000000).toISOString(),
      status: 'published',
    })
    expect(insertPublishedErr).not.toBeNull()

    // Inserting as 'pending' (normal submit-for-review flow) must succeed.
    const pendingTitle = 'bypass-pending-' + uid
    const { data: pendingRows, error: insertPendingErr } = await ownerClient
      .from('events')
      .insert({
        organizer_id: uid, title: pendingTitle, city: '台北市', district: '大安區',
        start_at: new Date(Date.now() + 86400000).toISOString(),
        end_at: new Date(Date.now() + 90000000).toISOString(),
        status: 'pending',
      })
      .select('id')
    expect(insertPendingErr).toBeNull()
    expect(pendingRows?.length).toBe(1)

    // The owner must not be able to self-promote their own pending event to
    // 'published' via update — events_update's with-check blocks it.
    const { data: updateRows, error: updateErr } = await ownerClient
      .from('events')
      .update({ status: 'published' })
      .eq('title', pendingTitle)
      .select('id')
    expect(updateErr).not.toBeNull()
    expect(updateRows ?? []).toEqual([])

    // Confirm via service role that the row is still 'pending' (untouched).
    const { data: finalRow } = await admin.from('events').select('status').eq('title', pendingTitle).single()
    expect(finalRow?.status).toBe('pending')
  })
})
