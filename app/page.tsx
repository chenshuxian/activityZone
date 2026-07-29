import { Suspense } from 'react'
import { EventCard } from '@/components/EventCard'
import { FilterBar } from '@/components/FilterBar'
import { listPublishedEvents } from '@/lib/events/queries'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')
  const events = await listPublishedEvents({
    city: sp.city, district: sp.district,
    categorySlugs: sp.cat ? [sp.cat] : undefined,
    keyword: sp.keyword,
  })
  return (
    <main>
      <Suspense fallback={null}>
        <FilterBar categories={categories ?? []} />
      </Suspense>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
        {events.map(e => <EventCard key={e.id} event={e} />)}
        {events.length === 0 && <p className="text-gray-500">目前沒有符合的活動</p>}
      </section>
    </main>
  )
}
