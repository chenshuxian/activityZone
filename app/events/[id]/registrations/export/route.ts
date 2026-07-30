import { createClient } from '@/lib/supabase/server'
import { getEventRegistrations } from '@/lib/events/registrations-admin'
import { toRegistrationsCsv } from '@/lib/events/csv'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  let rows
  try { rows = await getEventRegistrations(id) }
  catch { return new Response('forbidden', { status: 403 }) }
  const csv = '﻿' + toRegistrationsCsv(rows) // UTF-8 BOM so Excel reads Chinese correctly
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registrations-${id}.csv"`,
    },
  })
}
