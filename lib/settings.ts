'use server'
import { createClient } from '@/lib/supabase/server'
import type { HeroSettings } from '@/lib/types'

const DEFAULTS: HeroSettings = {
  title: '發現你附近的每一場精彩',
  subtitle: '在地活動，一次看盡。依地區與興趣，為你推薦。',
  image: null,
}

export async function getHeroSettings(): Promise<HeroSettings> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_settings')
    .select('hero_title, hero_subtitle, hero_image')
    .eq('id', 1)
    .maybeSingle()
  return {
    title: data?.hero_title || DEFAULTS.title,
    subtitle: data?.hero_subtitle || DEFAULTS.subtitle,
    image: data?.hero_image ?? null,
  }
}

export async function updateHeroSettings(input: HeroSettings) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      hero_title: input.title,
      hero_subtitle: input.subtitle,
      hero_image: input.image,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  return { ok: !error, error: error?.message }
}
