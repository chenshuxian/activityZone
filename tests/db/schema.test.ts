import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'

const url = process.env.SUPABASE_TEST_URL
const anon = process.env.SUPABASE_TEST_ANON_KEY

// Integration test against a local Supabase instance. Skipped when the env
// vars aren't provided (e.g. plain `npm test` without a running local
// Supabase) so it doesn't break the rest of the unit test suite.
describe.skipIf(!url || !anon)('db schema', () => {
  let db: ReturnType<typeof createClient>
  beforeAll(() => { db = createClient(url!, anon!) })

  test('種子分類含 6 個項目', async () => {
    const { data, error } = await db.from('categories').select('slug')
    expect(error).toBeNull()
    expect(data?.map(c => c.slug).sort()).toEqual(
      ['craft','family','food','music','sports','temple']
    )
  })
})
