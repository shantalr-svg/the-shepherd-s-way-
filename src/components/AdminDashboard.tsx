'use client'

import { useState } from 'react'
import type { Profile, Track, UserRole } from '@/types/database'
import { useRouter } from 'next/navigation'
import AccountManagement from '@/components/AccountManagement'

interface Props {
  adminName: string
  profiles: Profile[]
  tracks: Track[]
  enrollments: any[]
}

export default function AdminDashboard({ adminName, profiles, tracks, enrollments }: Props) {
  const router = useRouter()
  const getSupabase = () => {
    const { createClient } = require('@/lib/supabase/client')
    return createClient()
  }

  const [tab, setTab] = useState<'accounts' | 'people' | 'enrollments' | 'tracks'>('accounts')
  const [showInvite, setShowInvite] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('disciple')
  const [enrollDiscipleId, setEnrollDiscipleId] = useState('')
  const [enrollDisciplerId, setEnrollDisciplerId] = useState('')
  const [enrollTrackId, setEnrollTrackId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const disciplers = profiles.filter((p) => p.role === 'discipler')
  const disciples = profiles.filter((p) => ['disciple', 'graduate'].includes(p.role))

  async function sendInvite() {
    setError(''); setSuccess('')
    setSaving(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
      })
      const data = await res.json().catch(() => ({ error: 'Invitation failed' }))
      if (!res.ok) { setError(data.error ?? 'Invitation failed'); return }
      setSuccess(`Invite sent to ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail(''); setInviteName(''); setInviteRole('disciple')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invitation failed')
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(profileId: string, role: UserRole) {
    setError(''); setSuccess('')
    try {
      const { error } = await getSupabase().from('profiles').update({ role }).eq('id', profileId)
      if (error) { setError(error.message); return }
      setSuccess('Role updated.')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Role update failed')
    }
  }

  async function createEnrollment() {
    setError(''); setSuccess('')
    setSaving(true)
    try {
      const { error: err } = await getSupabase().from('enrollments').insert({
        disciple_id: enrollDiscipleId,
        discipler_id: enrollDisciplerId,
        track_id: enrollTrackId,
        status: 'active',
      })
      if (err) { setError(err.message); return }
      setSuccess('Enrollment created.')
      setShowEnroll(false)
      setEnrollDiscipleId(''); setEnrollDisciplerId(''); setEnrollTrackId('')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Enrollment creation failed')
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    const { error } = await getSupabase().auth.signOut()
    if (error) { setError(error.message); return }
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-stone-900">Fishers of Men</h1>
          <p className="text-xs text-stone-500">Admin — {adminName}</p>
        </div>
        <button onClick={signOut} className="text-sm text-stone-500 hover:text-stone-800">Sign out</button>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
          {(['accounts', 'enrollments', 'tracks'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

        {tab === 'accounts' && <AccountManagement profiles={profiles} />}

        {/* People tab */}
        {tab === 'people' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900">People ({profiles.length})</h2>
              <button
                onClick={() => setShowInvite(true)}
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                + Invite by email
              </button>
            </div>

            {showInvite && (
              <div className="mb-4 p-4 bg-white rounded-xl border border-stone-200 space-y-3">
                <div>
                  <h3 className="font-medium text-stone-900 text-sm mb-0.5">Invite new member</h3>
                  <p className="text-xs text-stone-400">They will receive an email to set their password and join.</p>
                </div>
                <input
                  placeholder="Full name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="disciple">Disciple</option>
                  <option value="discipler">Discipler</option>
                  <option value="graduate">Graduate</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={sendInvite}
                    disabled={saving || !inviteEmail || !inviteName}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                  >
                    {saving ? 'Sending…' : 'Send invite'}
                  </button>
                  <button onClick={() => setShowInvite(false)} className="text-sm text-stone-500">Cancel</button>
                </div>
              </div>
            )}

            {/* Direct database note */}
            <div className="mb-4 p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500">
              You can also add members directly in the Supabase dashboard → Authentication → Users → Add user, then set their role in the <code className="font-mono bg-stone-100 px-1 rounded">profiles</code> table.
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Change role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">{p.full_name}</td>
                      <td className="px-4 py-3 text-stone-500">{p.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          p.role === 'discipler' ? 'bg-emerald-100 text-emerald-700' :
                          p.role === 'graduate' ? 'bg-amber-100 text-amber-700' :
                          'bg-stone-100 text-stone-600'
                        }`}>{p.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={p.role}
                          onChange={(e) => changeRole(p.id, e.target.value as UserRole)}
                          className="border border-stone-200 rounded px-2 py-1 text-xs"
                        >
                          <option value="disciple">Disciple</option>
                          <option value="discipler">Discipler</option>
                          <option value="graduate">Graduate</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Enrollments tab */}
        {tab === 'enrollments' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900">Enrollments ({enrollments.length})</h2>
              <button
                onClick={() => setShowEnroll(true)}
                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
              >
                + Enroll disciple
              </button>
            </div>

            {showEnroll && (
              <div className="mb-4 p-4 bg-white rounded-xl border border-stone-200 space-y-3">
                <h3 className="font-medium text-stone-900 text-sm">New enrollment</h3>
                <select value={enrollDiscipleId} onChange={(e) => setEnrollDiscipleId(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select disciple…</option>
                  {disciples.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <select value={enrollDisciplerId} onChange={(e) => setEnrollDisciplerId(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Assign to discipler…</option>
                  {disciplers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <select value={enrollTrackId} onChange={(e) => setEnrollTrackId(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select track…</option>
                  {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={createEnrollment}
                    disabled={saving || !enrollDiscipleId || !enrollDisciplerId || !enrollTrackId}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Enroll'}
                  </button>
                  <button onClick={() => setShowEnroll(false)} className="text-sm text-stone-500">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Disciple</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Discipler</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Track</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {enrollments.map((e: any) => (
                    <tr key={e.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">{e.disciple?.full_name}</td>
                      <td className="px-4 py-3 text-stone-600">{e.discipler?.full_name}</td>
                      <td className="px-4 py-3 text-stone-500">{e.track?.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          e.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-stone-100 text-stone-500'
                        }`}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tracks tab */}
        {tab === 'tracks' && (
          <div>
            <h2 className="font-semibold text-stone-900 mb-4">Curriculum Tracks</h2>
            <div className="space-y-3">
              {tracks.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">#{t.order_index}</span>
                    <h3 className="font-medium text-stone-900">{t.title}</h3>
                  </div>
                  {t.description && <p className="text-sm text-stone-500">{t.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
