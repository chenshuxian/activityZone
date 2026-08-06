'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BannerItem, HeroSettings } from '@/lib/types'
import { formatDate } from '@/lib/time'

const INTRO_DEFAULTS: HeroSettings = {
  title: '發現你附近的每一場精彩',
  subtitle: '在地活動，一次看盡。依地區與興趣，為你推薦。',
  image: null,
}

export function BannerCarousel({
  banners, withIntro = false, intro,
}: { banners: BannerItem[]; withIntro?: boolean; intro?: HeroSettings }) {
  const total = (withIntro ? 1 : 0) + banners.length
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (total <= 1) return
    const reduce = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    if (reduce) return
    const t = setInterval(() => setIdx(i => (i + 1) % total), 5000)
    return () => clearInterval(t)
  }, [total])

  if (total === 0) return null
  const safeIdx = Math.min(idx, total - 1)
  const isIntro = withIntro && safeIdx === 0
  const hero = intro ?? INTRO_DEFAULTS
  const b = withIntro ? banners[safeIdx - 1] : banners[safeIdx]
  const image = isIntro ? (hero.image || '/default-banner.svg') : (b.coverImage || '/default-banner.svg')
  const date = b ? formatDate(b.startAt, { month: 'numeric', day: 'numeric', weekday: 'short' }) : ''

  return (
    <section className="relative h-[70vh] min-h-[400px] w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={isIntro ? hero.title : b.title}
        className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute inset-x-0 bottom-20 mx-auto max-w-6xl px-5 sm:px-8">
        {isIntro ? (
          <div className="max-w-2xl">
            <h2 className="text-4xl font-black leading-[1.05] tracking-hero text-white drop-shadow-lg sm:text-6xl">
              {hero.title}
            </h2>
            <p className="mt-4 max-w-xl whitespace-pre-line text-base text-white/90 sm:text-lg">
              {hero.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#browse"
                className="inline-flex items-center rounded-pill bg-accent px-7 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover">
                開始探索
              </Link>
              <Link href="/events/new"
                className="inline-flex items-center rounded-pill border border-white/60 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                發布活動
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="mb-2 text-sm font-semibold tracking-wide text-white/80">主打活動</div>
            <h2 className="text-4xl font-black leading-[1.05] tracking-hero text-white drop-shadow-lg sm:text-6xl">
              {b.title}
            </h2>
            <p className="mt-3 text-base text-white/90 sm:text-lg">{date} · {b.city}{b.district}</p>
            <Link href={`/events/${b.eventId}`}
              className="mt-6 inline-flex items-center rounded-pill bg-accent px-7 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover">
              查看活動 →
            </Link>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="absolute bottom-8 right-6 flex gap-2 sm:right-10">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`第 ${i + 1} 張`}
              className={`h-2.5 rounded-full transition-all ${i === safeIdx ? 'w-7 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
          ))}
        </div>
      )}
    </section>
  )
}
