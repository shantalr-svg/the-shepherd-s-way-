'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
  enrollments: any[]
}

export default function DisciplerDashboard({ profile, enrollments }: Props) {
  const router = useRouter()
  const getSupabase = () => createClient()

  const [selected, setSelected] = useState<string | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [attended, setAttended] = useState(true)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('scripture')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'session' | 'task'>('session')

  const selectedEnrollment = enrollments.find((e) => e.id === selected)

  async function logSession() {
    if (!selected) return
    setSaving(true)
    await getSupabase().from('sessions').insert({
      enrollment_id: selected,
      session_date: new Date().toISOString().split('T')[0],
      attended,
      notes: sessionNotes,
    })
    setSaving(false)
    setSessionNotes('')
    router.refresh()
  }

  async function addTask() {
    if (!selected || !taskTitle.trim()) return
    setSaving(true)
    await getSupabase().from('tasks').insert({
      enrollment_id: selected,
      type: taskType,
      title: taskTitle,
    })
    setSaving(false)
    setTaskTitle('')
    router.refresh()
  }

  async function completeEnrollment(enrollmentId: string) {
    setSaving(true)
    await getSupabase().from('enrollments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', enrollmentId)
    setSaving(false)
    setSelected(null)
    router.refresh()
  }

  async function signOut() {
    await getSupabase().auth.signOut()
    router.push('/login')
  }

  const active = enrollments.filter((e) => e.status === 'active')
  const completed = enrollments.filter((e) => e.status === 'completed')

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-stone-900">Fishers of Men</h1>
          <p className="text-xs text-stone-500">Discipler — {profile.full_name}</p>
        </div>
        <button onClick={signOut} className="text-sm text-stone-500 hover:text-stone-800">Sign out</button>
      </header>

      <div className="max-w-4xl mx-auto p-6 grid md:grid-cols-2 gap-6">
        {/* Disciple list */}
        <div>
          <h2 className="font-semibold text-stone-900 mb-3">My Disciples ({active.length} active)</h2>
          <div className="space-y-2">
            {active.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e.id === selected ? null : e.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selected === e.id
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <p className="font-medium text-stone-900">{e.disciple?.full_name}</p>
                <p className="text-xs text-stone-500 mt-0.5">{e.track?.title}</p>
                <p className="text-xs text-stone-400">{e.disciple?.phone}</p>
              </button>
            ))}

            {completed.length > 0 && (
              <details className="mt-4">
                <summary className="text-sm text-stone-500 cursor-pointer">
                  {completed.length} completed
                </summary>
                <div className="mt-2 space-y-2">
                  {completed.map((e) => (
                    <div key={e.id} className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm">
                      <p className="font-medium text-stone-700">{e.disciple?.full_name}</p>
                      <p className="text-xs text-stone-400">{e.track?.title} — completed</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Action panel */}
        {selectedEnrollment && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">{selectedEnrollment.disciple?.full_name}</h3>
              <button
                onClick={() => completeEnrollment(selectedEnrollment.id)}
                disabled={saving}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg"
              >
                Mark complete
              </button>
            </div>

            <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1">
              {(['session', 'task'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    activeTab === t ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
                  }`}
                >
                  Log {t}
                </button>
              ))}
            </div>

            {activeTab === 'session' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={attended}
                    onChange={(e) => setAttended(e.target.checked)}
                    className="rounded"
                  />
                  Attended
                </label>
                <textarea
                  placeholder="Session notes…"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
                <button
                  onClick={logSession}
                  disabled={saving}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Log session'}
                </button>
              </div>
            )}

            {activeTab === 'task' && (
              <div className="space-y-3">
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="scripture">Scripture</option>
                  <option value="assignment">Assignment</option>
                  <option value="reading">Reading</option>
                  <option value="other">Other</option>
                </select>
                <input
                  placeholder="Task title / reference"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={addTask}
                  disabled={saving || !taskTitle.trim()}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Assign task'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
