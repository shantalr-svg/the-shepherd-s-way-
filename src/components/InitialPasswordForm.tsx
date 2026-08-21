'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { validateReplacementPassword } from '@/lib/password'
import { createClient } from '@/lib/supabase/client'

export default function InitialPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const policyError = validateReplacementPassword(password)
    if (policyError) return setError(policyError)
    if (password !== confirmation) return setError('The passwords do not match.')
    setLoading(true); setError('')
    const supabase = createClient()
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password })
      if (passwordError) throw passwordError
      const { error: profileError } = await supabase.rpc('complete_initial_password_change')
      if (profileError) { await supabase.auth.signOut(); throw new Error('Account setup could not finish. Please sign in again or contact an administrator.') }
      router.push('/dashboard'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Password change failed.') }
    finally { setLoading(false) }
  }
  return <form onSubmit={submit} className="space-y-4">{error && <p className="p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</p>}
    <label className="block text-sm font-medium">New password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
    <label className="block text-sm font-medium">Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
    <p className="text-xs text-stone-500">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
    <button disabled={loading} className="w-full bg-emerald-600 text-white py-2 rounded-lg disabled:opacity-50">{loading ? 'Saving…' : 'Choose new password'}</button>
  </form>
}
