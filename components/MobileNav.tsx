'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button aria-label="選單" onClick={() => setOpen(o => !o)} className="flex items-center text-secondary">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-40 border-b border-hairline bg-glass backdrop-blur-xl">
          <nav className="flex flex-col gap-1 px-5 py-3 text-sm" onClick={() => setOpen(false)}>
            <Link href="/" className="py-1.5">探索</Link>
            <Link href="/events/new" className="py-1.5">發布活動</Link>
            {loggedIn && <Link href="/dashboard" className="py-1.5">我的活動</Link>}
            {loggedIn && <Link href="/favorites" className="py-1.5">我的收藏</Link>}
          </nav>
        </div>
      )}
    </div>
  )
}
