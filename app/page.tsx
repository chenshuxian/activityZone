import { Suspense } from 'react'
import { EventCard } from '@/components/EventCard'
import { FilterBar } from '@/components/FilterBar'
import { BannerCarousel } from '@/components/BannerCarousel'
import { Row } from '@/components/ui/Row'
import { ButtonLink } from '@/components/ui/Button'
import { listPublishedEvents } from '@/lib/events/queries'
import { getMyFavoriteEventIds } from '@/lib/favorites'
import { getHomeBanners } from '@/lib/banners'
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

  return (
    <main>
      {!filtering && (
        <section className="bg-background px-5 py-16 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.1] tracking-hero sm:text-5xl">
            發現你附近的<br />
            <span className="text-accent">每一場精彩</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-secondary">
            在地活動，一次看盡。依地區與興趣，為你推薦。
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <ButtonLink href="#browse">開始探索</ButtonLink>
            <ButtonLink href="/events/new" variant="ghost">發布活動</ButtonLink>
          </div>
        </section>
      )}

      {!filtering && <BannerCarousel banners={banners} />}

      <div id="browse" className="border-y border-hairline bg-surface/60">
        <Suspense fallback={null}>
          <FilterBar categories={categories ?? []} />
        </Suspense>
      </div>

      {filtering ? (
        <section className="mx-auto max-w-6xl px-5 py-10">
          <p className="mb-5 text-secondary">{events.length} 個結果</p>
          {events.length === 0 ? (
            <p className="text-secondary">目前沒有符合的活動</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {events.map(e => <EventCard key={e.id} event={e} isFavorited={favIds.has(e.id)} />)}
            </div>
          )}
        </section>
      ) : events.length === 0 ? (
        <p className="mx-auto max-w-6xl px-5 py-16 text-center text-secondary">
          目前還沒有活動，成為第一個發布的人吧！
        </p>
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
