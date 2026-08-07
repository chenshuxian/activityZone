'use client'
import { Trash2 } from 'lucide-react'

export function DeleteEventButton({
  id, title, action,
}: {
  id: string
  title: string
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`確定要刪除「${title}」嗎？此動作無法復原，報名資料也會一併刪除。`)) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        className="inline-flex items-center gap-1 rounded-pill border border-hairline px-3 py-1 text-xs font-medium text-red-600 hover:border-red-600 hover:bg-red-50"
        aria-label={`刪除 ${title}`}
      >
        <Trash2 size={13} /> 刪除
      </button>
    </form>
  )
}
