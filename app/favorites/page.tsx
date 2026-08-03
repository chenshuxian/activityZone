import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMyFavorites } from '@/lib/favorites'
import { EventCard } from '@/components/EventCard'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const events = await getMyFavorites()
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">我的收藏</h1>
      {events.length === 0 ? (
        <EmptyState icon={Heart} title="還沒有收藏" description="在活動卡片點愛心即可收藏" />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {events.map(e => <EventCard key={e.id} event={e} isFavorited={true} />)}
        </div>
      )}
    </main>
  )
}
