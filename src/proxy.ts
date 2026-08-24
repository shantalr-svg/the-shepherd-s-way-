import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnv } from '@/lib/supabase/env'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { url, anonKey } = getSupabasePublicEnv()

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('is_active, must_change_password').eq('auth_id', user.id).single()
    if (!profile?.is_active) {
      if (pathname === '/login') return supabaseResponse
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (profile.must_change_password && pathname !== '/initial-password') {
      return NextResponse.redirect(new URL('/initial-password', request.url))
    }
    if (!profile.must_change_password && pathname === '/initial-password') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname === '/login') return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
