import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DiscipleDashboard from '@/components/DiscipleDashboard'

export default async function DisciplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, discipler:discipler_id(full_name, phone)')
    .eq('auth_id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login')
  if (profile.must_change_password) redirect('/initial-password')
  if (!['disciple', 'graduate'].includes(profile.role)) redirect('/dashboard')

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*, track:track_id(title, description), tasks(*), sessions(*)')
    .eq('disciple_id', profile.id)
    .order('started_at', { ascending: false })

  return (
    <DiscipleDashboard
      profile={profile}
      enrollments={enrollments ?? []}
    />
  )
}
