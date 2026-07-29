import { approveEvent, rejectEvent } from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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
    <main>
      <h1 className="text-xl font-bold p-3">待審核活動（{rows.length}）</h1>
      <ul className="flex flex-col gap-2 p-3">
        {rows.map(e => (
          <li key={e.id} className="border rounded p-3">
            <div className="font-semibold">{e.title}</div>
            <div className="text-sm text-gray-500">
              {e.city}{e.district} · {new Date(e.start_at).toLocaleString('zh-TW')} · {e.organizer_name}
            </div>
            <div className="flex gap-2 mt-2">
              <form action={approve}><input type="hidden" name="id" value={e.id} />
                <button className="bg-green-600 text-white rounded px-3 py-1">核准</button></form>
              <form action={reject} className="flex gap-1">
                <input type="hidden" name="id" value={e.id} />
                <input name="reason" placeholder="退回原因" className="border rounded px-2" />
                <button className="bg-red-600 text-white rounded px-3 py-1">退回</button></form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
