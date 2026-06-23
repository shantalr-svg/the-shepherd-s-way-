'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toE164Zimbabwe, isValidE164 } from '@/lib/phone'
import { useRouter } from 'next/navigation'

type Mode = 'phone' | 'email'
type Step = 'input' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const getSupabase = () => createClient()

  const [mode, setMode] = useState<Mode>('phone')
  const [step, setStep] = useState<Step>('input')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function sendOtp() {
    setError('')
    setLoading(true)
    const e164 = toE164Zimbabwe(phone)
    if (!isValidE164(e164)) {
      setError('Enter a valid phone number (e.g. 0771234567)')
      setLoading(false)
      return
    }
    const { error: err } = await getSupabase().auth.signInWithOtp({
      phone: e164,
      options: { channel: 'whatsapp' },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('otp')
    setResendCooldown(60)
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    const e164 = toE164Zimbabwe(phone)
    const { error: err } = await getSupabase().auth.verifyOtp({
      phone: e164,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/dashboard')
  }

  async function emailLogin() {
    setError('')
    setLoading(true)
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-stone-900">The Shepherd&apos;s Way</h1>
          <p className="text-sm text-stone-500 mt-1">Fishers of Men</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-stone-200 mb-6 overflow-hidden">
          <button
            onClick={() => { setMode('phone'); setStep('input'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'phone' ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            Phone
          </button>
          <button
            onClick={() => { setMode('email'); setStep('input'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'email' ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            Email
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === 'phone' && (
          <>
            {step === 'input' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Phone number</label>
                  <input
                    type="tel"
                    placeholder="0771234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-stone-400 mt-1">We&apos;ll send a code via WhatsApp</p>
                </div>
                <button
                  onClick={sendOtp}
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send WhatsApp code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Enter the 6-digit code sent to {toE164Zimbabwe(phone)}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={verifyOtp}
                  disabled={loading || otp.length < 6}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Verify code'}
                </button>
                <button
                  onClick={resendCooldown > 0 ? undefined : sendOtp}
                  disabled={resendCooldown > 0}
                  className="w-full text-sm text-stone-500 hover:text-emerald-600 disabled:opacity-40"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button
                  onClick={() => { setStep('input'); setOtp(''); setError('') }}
                  className="w-full text-sm text-stone-400 hover:text-stone-600"
                >
                  Change number
                </button>
              </div>
            )}
          </>
        )}

        {mode === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={emailLogin}
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
