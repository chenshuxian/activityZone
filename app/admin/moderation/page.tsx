import { approveEvent, rejectEvent, deleteEvent } from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ModerationGrid } from '@/components/ModerationGrid'
import { DeleteEventButton } from '@/components/DeleteEventButton'
import { AdminNav } from '@/components/AdminNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { CalendarX } from 'lucide-react'
import { formatDateTime } from '@/lib/time'

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

  const { data: published } = await supabase.from('events')
    .select('id, title, city, district, start_at, organizer_name')
    .eq('status', 'published').order('start_at', { ascending: true })
  const live = published ?? []

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
  async function remove(formData: FormData) {
    'use server'
    await deleteEvent(String(formData.get('id')))
    revalidatePath('/admin/moderation')
    revalidatePath('/')
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <AdminNav />
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">待審核活動（{rows.length}）</h1>
      <ModerationGrid
        rows={rows.map(e => ({
          id: e.id, title: e.title, city: e.city, district: e.district,
          startAt: e.start_at, organizerName: e.organizer_name,
        }))}
        approveAction={approve}
        rejectAction={reject}
      />

      <h2 className="mb-4 mt-10 text-2xl font-bold tracking-tight-a">已上架活動（{live.length}）</h2>
      <div className="overflow-x-auto rounded-card border border-hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface">
              <th className="px-3 py-2.5 text-left font-medium text-secondary">活動標題</th>
              <th className="px-3 py-2.5 text-left font-medium text-secondary">地區</th>
              <th className="px-3 py-2.5 text-left font-medium text-secondary">開始時間</th>
              <th className="px-3 py-2.5 text-left font-medium text-secondary">主辦</th>
              <th className="px-3 py-2.5 text-left font-medium text-secondary">動作</th>
            </tr>
          </thead>
          <tbody>
            {live.map(e => (
              <tr key={e.id} className="border-b border-hairline last:border-b-0">
                <td className="px-3 py-2.5 font-medium">
                  <Link href={`/events/${e.id}`} className="hover:text-accent hover:underline">{e.title}</Link>
                </td>
                <td className="px-3 py-2.5 text-secondary">{e.city}{e.district}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-secondary">{formatDateTime(e.start_at)}</td>
                <td className="px-3 py-2.5 text-secondary">{e.organizer_name}</td>
                <td className="px-3 py-2.5">
                  <DeleteEventButton id={e.id} title={e.title} action={remove} />
                </td>
              </tr>
            ))}
            {live.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon={CalendarX} title="目前沒有已上架的活動" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
