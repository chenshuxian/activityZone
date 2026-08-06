import { Suspense } from 'react'
import { CalendarX, SearchX } from 'lucide-react'
import { EventCard } from '@/components/EventCard'
import { FilterBar } from '@/components/FilterBar'
import { BannerCarousel } from '@/components/BannerCarousel'
import { Row } from '@/components/ui/Row'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { listPublishedEvents } from '@/lib/events/queries'
import { getMyFavoriteEventIds } from '@/lib/favorites'
import { getHomeBanners } from '@/lib/banners'
import { getHeroSettings } from '@/lib/settings'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const filtering = Boolean(sp.city || sp.district || sp.cat || sp.keyword)
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id,name,slug,icon')
  const events = await listPublishedEvents({
    city: sp.city,
    district: sp.district,
    categorySlugs: sp.cat ? [sp.cat] : undefined,
    keyword: sp.keyword,
  })
  const freeEvents = events.filter(e => e.isFree)
  const favIds = new Set(await getMyFavoriteEventIds())
  const banners = filtering ? [] : await getHomeBanners()
  const hero = filtering ? null : await getHeroSettings()

  return (
    <main>
      {!filtering && <BannerCarousel banners={banners} withIntro intro={hero ?? undefined} />}

      <div id="browse" className="border-y border-hairline bg-surface/60">
        <Suspense fallback={null}>
          <FilterBar categories={categories ?? []} />
        </Suspense>
      </div>

      {filtering ? (
        <section className="mx-auto max-w-6xl px-5 py-10">
          <p className="mb-5 text-secondary">{events.length} 個結果</p>
          {events.length === 0 ? (
            <EmptyState icon={SearchX} title="沒有符合的活動" description="換個條件再試試" />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {events.map(e => <EventCard key={e.id} event={e} isFavorited={favIds.has(e.id)} />)}
            </div>
          )}
        </section>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="目前還沒有活動"
          description="成為第一個發布的人吧！"
          action={<ButtonLink href="/events/new">發布活動</ButtonLink>}
        />
      ) : (
        <>
          <Row title="近期活動" subtitle="越近期，越前面。">
            {events.map(e => (
              <div key={e.id} className="w-[240px] shrink-0">
                <EventCard event={e} isFavorited={favIds.has(e.id)} />
              </div>
            ))}
          </Row>
          {freeEvents.length > 0 && (
            <div className="bg-surface">
              <Row title="免費活動" subtitle="不用花錢也能很精彩。">
                {freeEvents.map(e => (
                  <div key={e.id} className="w-[240px] shrink-0">
                    <EventCard event={e} isFavorited={favIds.has(e.id)} />
                  </div>
                ))}
              </Row>
            </div>
          )}
        </>
      )}
    </main>
  )
}
