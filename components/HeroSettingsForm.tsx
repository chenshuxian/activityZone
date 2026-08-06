'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateHeroSettings } from '@/lib/settings'
import { CoverImageUpload } from '@/components/CoverImageUpload'
import { Button } from '@/components/ui/Button'
import type { HeroSettings } from '@/lib/types'

export function HeroSettingsForm({ initial }: { initial: HeroSettings }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [subtitle, setSubtitle] = useState(initial.subtitle)
  const [image, setImage] = useState<string | null>(initial.image)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true); setSaved(false)
    const res = await updateHeroSettings({ title, subtitle, image })
    setSaving(false)
    if (res.ok) { setSaved(true); router.refresh() }
  }

  const inputClass =
    'w-full rounded-lg border border-hairline bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-secondary focus:border-accent'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium">主標題</label>
        <input value={title} onChange={e => { setTitle(e.target.value); setSaved(false) }} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">副標文字</label>
        <textarea value={subtitle} onChange={e => { setSubtitle(e.target.value); setSaved(false) }} rows={2} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">背景圖（選填，留空用預設藍色圖）</label>
        <CoverImageUpload initialUrl={image ?? undefined} onChange={(url) => { setImage(url); setSaved(false) }} />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存'}</Button>
        {saved && <span className="text-sm font-medium text-accent">已儲存 ✓</span>}
      </div>
    </div>
  )
}
