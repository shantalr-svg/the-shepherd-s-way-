'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const getSupabase = () => {
    const { createClient } = require('@/lib/supabase/client')
    return createClient()
  }

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sets the session from the URL hash when the page loads
    const supabase = getSupabase()
    supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function updatePassword() {
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error: err } = await getSupabase().auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/dashboard')
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
          <p className="text-sm text-stone-500">Verifying your reset link…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-stone-900">Set new password</h1>
          <p className="text-sm text-stone-500 mt-1">Choose a password you&apos;ll remember</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">New password</label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Confirm password</label>
            <input
              type="password"
              placeholder="Same password again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updatePassword()}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={updatePassword}
            disabled={loading || !password || !confirm}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  )
}
