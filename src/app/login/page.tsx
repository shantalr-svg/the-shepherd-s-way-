'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeZimbabwePhone } from '@/lib/phone'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function login() {
    setLoading(true); setError('')
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ phone: normalizeZimbabwePhone(phone), password })
      if (signInError) throw signInError
      router.push('/dashboard'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.') }
    finally { setLoading(false) }
  }
  return <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4"><section className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8">
    <div className="mb-8 text-center"><h1 className="text-2xl font-bold">The Shepherd&apos;s Way</h1><p className="text-sm text-stone-500">Fishers of Men</p></div>
    {error && <p className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</p>}
    <div className="space-y-4">
      <label className="block text-sm font-medium">Phone number<input type="tel" autoComplete="tel" placeholder="077 282 9203" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
      <label className="block text-sm font-medium">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
      <button onClick={login} disabled={loading || !phone || !password} className="w-full bg-emerald-600 text-white py-2 rounded-lg disabled:opacity-50">{loading ? 'Signing in…' : 'Sign in'}</button>
      <p className="text-xs text-stone-500 text-center">Contact an administrator if you need access or a new password.</p>
    </div>
  </section></main>
}
