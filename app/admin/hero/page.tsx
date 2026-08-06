import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHeroSettings } from '@/lib/settings'
import { HeroSettingsForm } from '@/components/HeroSettingsForm'
import { AdminNav } from '@/components/AdminNav'

export default async function AdminHeroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const hero = await getHeroSettings()

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <AdminNav />
      <h1 className="mb-2 text-2xl font-bold tracking-tight-a">首頁設定</h1>
      <p className="mb-6 text-sm text-secondary">編輯首頁大圖的標題、副標與背景圖。</p>
      <HeroSettingsForm initial={hero} />
    </main>
  )
}
