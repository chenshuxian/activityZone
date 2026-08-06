// 全站時間一律以台灣時間（Asia/Taipei，固定 UTC+8、無日光節約）處理。
// 資料庫存的是帶時區的 UTC 瞬間；使用者輸入與畫面顯示都用台灣壁鐘時間。
export const TAIPEI_TZ = 'Asia/Taipei'
const TAIPEI_OFFSET = '+08:00'

// 表單的 naive 時間字串（YYYY-MM-DDTHH:mm，視為台灣時間）→ 帶時區 ISO，供資料庫存正確 UTC 瞬間
export function taipeiLocalToISO(local: string): string {
  if (!local || !local.includes('T')) return local
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return `${withSeconds}${TAIPEI_OFFSET}`
}

// 儲存的 ISO 瞬間 → 台灣壁鐘時間的 { date: 'YYYY-MM-DD', time: 'HH:mm' }，供 <input> 預設值
export function isoToTaipeiParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
}

// 儲存的 ISO 瞬間 → 表單用的 'YYYY-MM-DDTHH:mm'（台灣時間）
export function taipeiInputValue(iso: string): string {
  const { date, time } = isoToTaipeiParts(iso)
  return `${date}T${time}`
}

// 顯示：日期＋時間（例：2026年8月6日 上午10:00）
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: TAIPEI_TZ,
  })
}

// 顯示：純日期，可帶額外選項
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleDateString('zh-TW', { timeZone: TAIPEI_TZ, ...opts })
}
