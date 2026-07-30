'use client'
import { createEvent } from '@/lib/events/actions'
import type { EventInput } from '@/lib/events/mutations'
import type { Category } from '@/lib/types'
import { CITIES, REGIONS } from '@/lib/regions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export function EventForm({ categories, initial, submitAction, submitLabel }: EventFormProps) {
  const router = useRouter()
  const [city, setCity] = useState(initial?.city ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function action(formData: FormData) {
    setSubmitting(true)
    const fieldSetting = (k: string) => String(formData.get(`rf_${k}`) ?? 'off')
    const input: EventInput = {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      city: String(formData.get('city') ?? ''),
      district: String(formData.get('district') ?? ''),
      address: String(formData.get('address') ?? ''),
      startAt: String(formData.get('startAt') ?? ''),
      endAt: String(formData.get('endAt') ?? ''),
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
    <form action={action} className="max-w-xl mx-auto p-4 flex flex-col gap-2">
      <h1 className="text-xl font-bold">{initial?.id ? '編輯活動' : '發布活動'}</h1>
      {errors.map(e => <p key={e} className="text-red-600 text-sm">{e}</p>)}
      <input name="title" placeholder="活動標題" defaultValue={initial?.title ?? ''} className="border rounded px-2 py-1" />
      <select name="city" value={city} onChange={e => setCity(e.target.value)} className="border rounded px-2 py-1">
        <option value="">選擇縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select name="district" defaultValue={initial?.district ?? ''} className="border rounded px-2 py-1">
        <option value="">選擇鄉鎮區</option>
        {(REGIONS[city] ?? []).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <input name="address" placeholder="地址" defaultValue={initial?.address ?? ''} className="border rounded px-2 py-1" />
      <label>開始 <input type="datetime-local" name="startAt" defaultValue={initial?.startAt ?? ''} className="border rounded px-2 py-1" /></label>
      <label>結束 <input type="datetime-local" name="endAt" defaultValue={initial?.endAt ?? ''} className="border rounded px-2 py-1" /></label>
      <input name="capacity" type="number" placeholder="名額（留空=不限）" defaultValue={initial?.capacity ?? ''} className="border rounded px-2 py-1" />
      <label><input type="checkbox" name="isFree" defaultChecked={initial?.isFree ?? true} /> 免費活動</label>
      <input name="organizerName" placeholder="主辦單位" defaultValue={initial?.organizerName ?? ''} className="border rounded px-2 py-1" />
      <input name="contactInfo" placeholder="聯絡方式" defaultValue={initial?.contactInfo ?? ''} className="border rounded px-2 py-1" />
      <textarea name="description" placeholder="活動描述" defaultValue={initial?.description ?? ''} className="border rounded px-2 py-1" />
      <fieldset className="flex flex-wrap gap-2">
        {categories.map(c => (
          <label key={c.id} className="border rounded px-2 py-1">
            <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={initial?.categoryIds?.includes(c.id) ?? false} /> {c.icon} {c.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="rounded-lg border border-hairline p-3">
        <legend className="px-1 text-sm text-secondary">報名要收集的欄位</legend>
        {([['party_size','同行人數'],['phone','聯絡電話'],['note','備註']] as const).map(([k,label]) => (
          <label key={k} className="flex items-center justify-between py-1 text-sm">
            {label}
            <select name={`rf_${k}`} defaultValue={initial?.registrationFields?.[k] ?? 'off'} className="rounded border border-hairline px-2 py-1">
              <option value="off">不收集</option>
              <option value="optional">選填</option>
              <option value="required">必填</option>
            </select>
          </label>
        ))}
      </fieldset>
      <button disabled={submitting} className="bg-black text-white rounded px-3 py-2">
        {submitting ? '送出中…' : (submitLabel ?? '送出審核')}
      </button>
    </form>
  )
}
