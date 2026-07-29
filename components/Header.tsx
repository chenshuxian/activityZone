'use client'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function Header() {
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])
  const login = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
  const logout = () => supabase.auth.signOut().then(() => location.reload())
  return (
    <header className="flex items-center gap-3 p-3 border-b">
      <Link href="/" className="font-bold">🎪 地方活動網</Link>
      <div className="ml-auto">
        {email
          ? <button onClick={logout}>登出（{email}）</button>
          : <button onClick={login}>Google 登入</button>}
      </div>
    </header>
  )
}
