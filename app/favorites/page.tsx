import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyFavorites } from '@/lib/favorites'
import { EventCard } from '@/components/EventCard'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const events = await getMyFavorites()
  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight-a">我的收藏</h1>
      {events.length === 0 ? (
        <p className="text-secondary">你還沒有收藏任何活動。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {events.map(e => <EventCard key={e.id} event={e} isFavorited={true} />)}
        </div>
      )}
    </main>
  )
}
