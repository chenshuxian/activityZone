export interface EventInput {
  title: string
  description?: string
  city: string
  district: string
  address?: string
  startAt: string
  endAt: string
  isFree: boolean
  feeNote?: string
  organizerName?: string
  contactInfo?: string
  capacity?: number | null
  categoryIds: string[]
}

export function validateEventInput(input: EventInput): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('請填寫活動標題')
  if (!input.city || !input.district) errors.push('請選擇活動地區')
  if (new Date(input.endAt) < new Date(input.startAt)) errors.push('結束時間不得早於開始時間')
  return errors
}
