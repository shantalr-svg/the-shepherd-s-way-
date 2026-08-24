import { redirect } from 'next/navigation'
import InitialPasswordForm from '@/components/InitialPasswordForm'
import { createClient } from '@/lib/supabase/server'

export default async function InitialPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_active, must_change_password').eq('auth_id', user.id).single()
  if (!profile?.is_active) redirect('/login')
  if (!profile.must_change_password) redirect('/dashboard')
  return <main className="min-h-screen bg-stone-50 flex items-center justify-center p-4"><section className="w-full max-w-md bg-white rounded-2xl border p-8"><h1 className="text-2xl font-bold mb-2">Choose your password</h1><p className="text-sm text-stone-600 mb-6">Replace the temporary password before continuing.</p><InitialPasswordForm /></section></main>
}
