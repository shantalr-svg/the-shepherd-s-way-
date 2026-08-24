import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, is_active, must_change_password')
    .eq('auth_id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login')
  if (profile.must_change_password) redirect('/initial-password')
  if (profile.role !== 'admin') redirect('/dashboard')

  const [{ data: profiles }, { data: tracks }, { data: enrollments }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('tracks').select('*').order('order_index'),
    supabase.from('enrollments').select('*, disciple:disciple_id(full_name, phone), discipler:discipler_id(full_name), track:track_id(title)'),
  ])

  return (
    <AdminDashboard
      adminName={profile.full_name}
      profiles={profiles ?? []}
      tracks={tracks ?? []}
      enrollments={enrollments ?? []}
    />
  )
}
