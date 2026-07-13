'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type View = 'login' | 'forgot' | 'forgot-sent'

export default function LoginPage() {
  const router = useRouter()
  const getSupabase = () => {
    const { createClient } = require('@/lib/supabase/client')
    return createClient()
  }

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setError('')
    setLoading(true)
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/dashboard')
  }

  async function sendResetEmail() {
    setError('')
    setLoading(true)
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setView('forgot-sent')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-stone-900">The Shepherd&apos;s Way</h1>
          <p className="text-sm text-stone-500 mt-1">Fishers of Men</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Login view */}
        {view === 'login' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-stone-700">Password</label>
                <button
                  onClick={() => { setError(''); setView('forgot') }}
                  className="text-xs text-emerald-600 hover:text-emerald-800"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={login}
              disabled={loading || !email || !password}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-xs text-stone-400 text-center">
              Contact your administrator if you need access.
            </p>
          </div>
        )}

        {/* Forgot password view */}
        {view === 'forgot' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-stone-600 mb-4">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendResetEmail()}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={sendResetEmail}
              disabled={loading || !email}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              onClick={() => { setError(''); setView('login') }}
              className="w-full text-sm text-stone-500 hover:text-stone-700"
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Email sent confirmation */}
        {view === 'forgot-sent' && (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-stone-900">Check your email</p>
              <p className="text-sm text-stone-500 mt-1">
                We sent a password reset link to <strong>{email}</strong>
              </p>
            </div>
            <button
              onClick={() => { setView('login'); setError('') }}
              className="w-full text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg py-2"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
