import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // 正式環境在反向代理（如 Vercel）後方，request.url 的 origin 可能是內部主機；
  // 用 x-forwarded-host 還原對外網域，OAuth 導回才會回到正確網址。
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`

  // OAuth provider returned an error (e.g. bad credentials, denied consent).
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  if (providerError) {
    return NextResponse.redirect(`${base}/?auth_error=${encodeURIComponent(providerError)}`)
  }
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${base}/?auth_error=${encodeURIComponent(error.message)}`)
    }
  }
  return NextResponse.redirect(base)
}
