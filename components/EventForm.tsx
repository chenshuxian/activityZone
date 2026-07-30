'use client'
import { createEvent } from '@/lib/events/actions'
import type { Category } from '@/lib/types'
import { CITIES, REGIONS } from '@/lib/regions'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function EventForm({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [city, setCity] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function action(formData: FormData) {
    setSubmitting(true)
    const fieldSetting = (k: string) => String(formData.get(`rf_${k}`) ?? 'off')
    const res = await createEvent({
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
    })
    if (!res.ok) { setErrors(res.errors); setSubmitting(false); return }
    router.push('/?submitted=1')
  }

  return (
    <form action={action} className="max-w-xl mx-auto p-4 flex flex-col gap-2">
      <h1 className="text-xl font-bold">發布活動</h1>
      {errors.map(e => <p key={e} className="text-red-600 text-sm">{e}</p>)}
      <input name="title" placeholder="活動標題" className="border rounded px-2 py-1" />
      <select name="city" value={city} onChange={e => setCity(e.target.value)} className="border rounded px-2 py-1">
        <option value="">選擇縣市</option>
        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select name="district" className="border rounded px-2 py-1">
        <option value="">選擇鄉鎮區</option>
        {(REGIONS[city] ?? []).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <input name="address" placeholder="地址" className="border rounded px-2 py-1" />
      <label>開始 <input type="datetime-local" name="startAt" className="border rounded px-2 py-1" /></label>
      <label>結束 <input type="datetime-local" name="endAt" className="border rounded px-2 py-1" /></label>
      <input name="capacity" type="number" placeholder="名額（留空=不限）" className="border rounded px-2 py-1" />
      <label><input type="checkbox" name="isFree" defaultChecked /> 免費活動</label>
      <input name="organizerName" placeholder="主辦單位" className="border rounded px-2 py-1" />
      <input name="contactInfo" placeholder="聯絡方式" className="border rounded px-2 py-1" />
      <textarea name="description" placeholder="活動描述" className="border rounded px-2 py-1" />
      <fieldset className="flex flex-wrap gap-2">
        {categories.map(c => (
          <label key={c.id} className="border rounded px-2 py-1">
            <input type="checkbox" name="categoryIds" value={c.id} /> {c.icon} {c.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="rounded-lg border border-hairline p-3">
        <legend className="px-1 text-sm text-secondary">報名要收集的欄位</legend>
        {([['party_size','同行人數'],['phone','聯絡電話'],['note','備註']] as const).map(([k,label]) => (
          <label key={k} className="flex items-center justify-between py-1 text-sm">
            {label}
            <select name={`rf_${k}`} defaultValue="off" className="rounded border border-hairline px-2 py-1">
              <option value="off">不收集</option>
              <option value="optional">選填</option>
              <option value="required">必填</option>
            </select>
          </label>
        ))}
      </fieldset>
      <button disabled={submitting} className="bg-black text-white rounded px-3 py-2">
        {submitting ? '送出中…' : '送出審核'}
      </button>
    </form>
  )
}
