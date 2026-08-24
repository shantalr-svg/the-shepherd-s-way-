import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveAccessDestination } from '@/lib/access-state'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, must_change_password')
    .eq('auth_id', user.id)
    .single()

  redirect(resolveAccessDestination(profile))
}
