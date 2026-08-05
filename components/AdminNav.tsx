'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/admin/moderation', label: '審核活動' },
  { href: '/admin/banners', label: 'Banner 管理' },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <nav className="mb-6 flex gap-1 border-b border-hairline">
      {tabs.map(t => {
        const active = path === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-b-2 border-accent text-foreground'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
