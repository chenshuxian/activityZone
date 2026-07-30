'use client'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NotificationBell } from '@/components/NotificationBell'

export function Header() {
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const login = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
  const logout = () => supabase.auth.signOut().then(() => location.reload())
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-glass backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-5 text-sm">
        <Link href="/" className="text-[15px] font-bold tracking-tight-a">活動網</Link>
        <nav className="hidden items-center gap-5 text-secondary sm:flex">
          <Link href="/" className="transition-colors hover:text-foreground">探索</Link>
          <Link href="/events/new" className="transition-colors hover:text-foreground">發布活動</Link>
          {email && <Link href="/dashboard" className="transition-colors hover:text-foreground">我的活動</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {email
            ? (
              <>
                <NotificationBell />
                <button onClick={logout} className="cursor-pointer font-medium text-accent" title={email}>登出</button>
              </>
            )
            : <button onClick={login} className="cursor-pointer font-medium text-accent">登入</button>}
        </div>
      </div>
    </header>
  )
}
