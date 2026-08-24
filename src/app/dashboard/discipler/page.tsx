import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DisciplerDashboard from '@/components/DisciplerDashboard'

export default async function DisciplerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login')
  if (profile.must_change_password) redirect('/initial-password')
  if (profile.role !== 'discipler') redirect('/dashboard')

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*, disciple:disciple_id(*), track:track_id(title, order_index)')
    .eq('discipler_id', profile.id)
    .order('started_at', { ascending: false })

  return (
    <DisciplerDashboard
      profile={profile}
      enrollments={enrollments ?? []}
    />
  )
}
