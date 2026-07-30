'use client'
import { createEvent } from '@/lib/events/actions'
import type { EventInput } from '@/lib/events/mutations'
import type { Category } from '@/lib/types'
import { CITIES, REGIONS } from '@/lib/regions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export interface EventFormInitial {
  id: string
  title?: string
  description?: string
  city?: string
  district?: string
  address?: string
  startAt?: string
  endAt?: string
  capacity?: number | null
  isFree?: boolean
  organizerName?: string
  contactInfo?: string
  categoryIds?: string[]
  registrationFields?: { party_size?: string; phone?: string; note?: string }
}

export interface EventFormProps {
  categories: Category[]
  initial?: EventFormInitial
  submitAction?: (input: EventInput) => Promise<{ ok: boolean; errors?: string[] }>
  submitLabel?: string
}

// 30 分鐘間隔的時間選項
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

function splitDateTime(value?: string): { date: string; time: string } {
  if (!value || !value.includes('T')) return { date: '', time: '' }
  const [date, time] = value.split('T')
  return { date, time: (time ?? '').slice(0, 5) }
}

const inputClass =
  'w-full rounded-lg border border-hairline bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-secondary focus:border-accent'
const labelClass = 'mb-1 block text-sm font-medium'

export function EventForm({ categories, initial, submitAction, submitLabel }: EventFormProps) {
  const router = useRouter()
  const [city, setCity] = useState(initial?.city ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const start = splitDateTime(initial?.startAt)
  const end = splitDateTime(initial?.endAt)

  async function action(formData: FormData) {
    setSubmitting(true)
    const fieldSetting = (k: string) => String(formData.get(`rf_${k}`) ?? 'off')
    const combine = (d: FormDataEntryValue | null, t: FormDataEntryValue | null) =>
      d && t ? `${String(d)}T${String(t)}` : ''
    const input: EventInput = {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      city: String(formData.get('city') ?? ''),
      district: String(formData.get('district') ?? ''),
      address: String(formData.get('address') ?? ''),
      startAt: combine(formData.get('startDate'), formData.get('startTime')),
      endAt: combine(formData.get('endDate'), formData.get('endTime')),
      isFree: formData.get('isFree') === 'on',
      organizerName: String(formData.get('organizerName') ?? ''),
      contactInfo: String(formData.get('contactInfo') ?? ''),
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : null,
      categoryIds: formData.getAll('categoryIds').map(String),
      registrationFields: {
        party_size: fieldSetting('party_size'),
        phone: fieldSetting('phone'),
        note: fieldSetting('note'),
      },
    }
    const res = await (submitAction ?? createEvent)(input)
    if (!res.ok) { setErrors(res.errors ?? []); setSubmitting(false); return }
    router.push(initial?.id ? '/dashboard' : '/?submitted=1')
  }

  return (
    <form action={action} className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight-a">{initial?.id ? '編輯活動' : '發布活動'}</h1>

      {errors.length > 0 && (
        <div className="rounded-lg border border-hairline bg-chip p-3">
          {errors.map(e => <p key={e} className="text-sm text-red-600">{e}</p>)}
        </div>
      )}

      <div>
        <label className={labelClass}>活動標題</label>
        <input name="title" placeholder="例：大安森林公園晨間瑜珈" defaultValue={initial?.title ?? ''} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>縣市</label>
          <select name="city" value={city} onChange={e => setCity(e.target.value)} className={inputClass}>
            <option value="">選擇縣市</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>鄉鎮區</label>
          <select name="district" defaultValue={initial?.district ?? ''} className={inputClass}>
            <option value="">選擇鄉鎮區</option>
            {(REGIONS[city] ?? []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>地址</label>
        <input name="address" placeholder="詳細地址（用於地圖導航）" defaultValue={initial?.address ?? ''} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>開始</label>
          <div className="flex gap-2">
            <input type="date" name="startDate" min={today} defaultValue={start.date} className={inputClass} />
            <select name="startTime" defaultValue={start.time || '10:00'} className={inputClass}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>結束</label>
          <div className="flex gap-2">
            <input type="date" name="endDate" min={today} defaultValue={end.date} className={inputClass} />
            <select name="endTime" defaultValue={end.time || '12:00'} className={inputClass}>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>名額</label>
          <input name="capacity" type="number" min={1} placeholder="留空 = 不限" defaultValue={initial?.capacity ?? ''} className={inputClass} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isFree" defaultChecked={initial?.isFree ?? true} className="h-4 w-4" /> 免費活動
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>主辦單位</label>
          <input name="organizerName" placeholder="主辦單位名稱" defaultValue={initial?.organizerName ?? ''} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>聯絡方式</label>
          <input name="contactInfo" placeholder="email 或電話" defaultValue={initial?.contactInfo ?? ''} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>活動描述</label>
        <textarea name="description" rows={4} placeholder="介紹活動內容、注意事項…" defaultValue={initial?.description ?? ''} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>活動類別</label>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <label key={c.id} className="cursor-pointer rounded-full border border-hairline px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-on-accent">
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={initial?.categoryIds?.includes(c.id) ?? false} className="sr-only" /> {c.name}
            </label>
          ))}
        </div>
      </div>

      <fieldset className="rounded-card border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-secondary">報名要收集的欄位</legend>
        {([['party_size', '同行人數'], ['phone', '聯絡電話'], ['note', '備註']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between py-1.5 text-sm">
            {label}
            <select name={`rf_${k}`} defaultValue={initial?.registrationFields?.[k] ?? 'off'} className="rounded-lg border border-hairline bg-card px-2 py-1">
              <option value="off">不收集</option>
              <option value="optional">選填</option>
              <option value="required">必填</option>
            </select>
          </label>
        ))}
      </fieldset>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? '送出中…' : (submitLabel ?? '送出審核')}
      </Button>
    </form>
  )
}
