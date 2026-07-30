import { approveEvent, rejectEvent } from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ModerationGrid } from '@/components/ModerationGrid'

export default async function ModerationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const { data: pending } = await supabase.from('events')
    .select('id, title, city, district, start_at, organizer_name')
    .eq('status', 'pending').order('created_at', { ascending: true })
  const rows = pending ?? []

  async function approve(formData: FormData) {
    'use server'
    await approveEvent(String(formData.get('id')))
    revalidatePath('/admin/moderation')
  }
  async function reject(formData: FormData) {
    'use server'
    await rejectEvent(String(formData.get('id')), String(formData.get('reason') ?? ''))
    revalidatePath('/admin/moderation')
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">待審核活動（{rows.length}）</h1>
      <ModerationGrid
        rows={rows.map(e => ({
          id: e.id, title: e.title, city: e.city, district: e.district,
          startAt: e.start_at, organizerName: e.organizer_name,
        }))}
        approveAction={approve}
        rejectAction={reject}
      />
    </main>
  )
}
