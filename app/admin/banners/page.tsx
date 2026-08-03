import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listManualBanners, addBanner, removeBanner, reorderBanner } from '@/lib/banners'

export default async function AdminBannersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const banners = await listManualBanners()
  const { data: events } = await supabase.from('events')
    .select('id, title').eq('status', 'published').order('start_at', { ascending: true }).limit(50)

  async function add(formData: FormData) {
    'use server'
    await addBanner(String(formData.get('eventId')))
    revalidatePath('/admin/banners')
  }
  async function remove(formData: FormData) {
    'use server'
    await removeBanner(String(formData.get('id')))
    revalidatePath('/admin/banners')
  }
  async function move(formData: FormData) {
    'use server'
    await reorderBanner(String(formData.get('id')), formData.get('dir') as 'up' | 'down')
    revalidatePath('/admin/banners')
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">Banner 管理</h1>

      <form action={add} className="mb-6 flex gap-2">
        <select name="eventId" className="flex-1 rounded-lg border border-hairline bg-card px-3 py-2 text-sm">
          {(events ?? []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <button className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-on-accent">加入 Banner</button>
      </form>

      <ul className="flex flex-col gap-2">
        {banners.length === 0 && <li className="text-secondary">目前沒有手動 banner（首頁會自動補近期活動）。</li>}
        {banners.map(b => (
          <li key={b.id} className="flex items-center gap-3 rounded-card border border-hairline bg-card p-3">
            <span className="flex-1 font-medium">{b.title}</span>
            <form action={move}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="dir" value="up" />
              <button className="px-2 text-secondary hover:text-foreground" aria-label="上移"><ChevronUp size={16} /></button></form>
            <form action={move}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="dir" value="down" />
              <button className="px-2 text-secondary hover:text-foreground" aria-label="下移"><ChevronDown size={16} /></button></form>
            <form action={remove}><input type="hidden" name="id" value={b.id} />
              <button className="px-2 text-red-600" aria-label="移除"><Trash2 size={16} /></button></form>
          </li>
        ))}
      </ul>
    </main>
  )
}
