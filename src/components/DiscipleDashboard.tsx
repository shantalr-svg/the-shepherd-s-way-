'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile & { discipler?: Profile }
  enrollments: any[]
}

export default function DiscipleDashboard({ profile, enrollments }: Props) {
  const router = useRouter()
  const getSupabase = () => createClient()
  const [error, setError] = useState('')
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)

  async function markTaskDone(taskId: string) {
    setError('')
    setSavingTaskId(taskId)
    try {
      const { error } = await getSupabase()
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) { setError(error.message); return }
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Task could not be completed')
    } finally {
      setSavingTaskId(null)
    }
  }

  async function signOut() {
    const { error } = await getSupabase().auth.signOut()
    if (error) { setError(error.message); return }
    router.push('/login')
  }

  const active = enrollments.find((e) => e.status === 'active')

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-stone-900">Fishers of Men</h1>
          <p className="text-xs text-stone-500">{profile.full_name}</p>
        </div>
        <button onClick={signOut} className="text-sm text-stone-500 hover:text-stone-800">Sign out</button>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        {/* Discipler info */}
        {profile.discipler && (
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <p className="text-xs text-stone-500 mb-1">Your discipler</p>
            <p className="font-semibold text-stone-900">{(profile.discipler as any).full_name}</p>
            <p className="text-sm text-stone-500">{(profile.discipler as any).phone}</p>
          </div>
        )}

        {/* Active enrollment */}
        {active ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 font-medium mb-1">Current track</p>
              <p className="font-bold text-stone-900">{active.track?.title}</p>
              {active.track?.description && (
                <p className="text-sm text-stone-600 mt-1">{active.track.description}</p>
              )}
            </div>

            {/* Tasks */}
            {active.tasks?.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <h3 className="font-semibold text-stone-900 mb-3">Tasks</h3>
                <div className="space-y-2">
                  {active.tasks.map((task: any) => (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg ${task.completed_at ? 'bg-stone-50' : 'bg-amber-50'}`}>
                      <button
                        onClick={() => !task.completed_at && markTaskDone(task.id)}
                        disabled={savingTaskId === task.id}
                        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 ${
                          task.completed_at
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-stone-300 hover:border-emerald-400'
                        }`}
                      >
                        {task.completed_at && (
                          <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
                            <path d="M13 4L6 11 3 8" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${task.completed_at ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-stone-400 capitalize">{task.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions */}
            {active.sessions?.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <h3 className="font-semibold text-stone-900 mb-3">Sessions ({active.sessions.length})</h3>
                <div className="space-y-2">
                  {active.sessions.slice(0, 5).map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.attended ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      <span className="text-stone-600">{new Date(s.session_date).toLocaleDateString()}</span>
                      {s.notes && <span className="text-stone-400 truncate">{s.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-stone-400">
            <p className="text-lg mb-2">No active enrollment</p>
            <p className="text-sm">Your discipler will assign you to a track.</p>
          </div>
        )}

        {/* Past enrollments */}
        {enrollments.filter((e) => e.status === 'completed').length > 0 && (
          <div>
            <h3 className="font-semibold text-stone-900 mb-2">Completed Tracks</h3>
            <div className="space-y-2">
              {enrollments.filter((e) => e.status === 'completed').map((e) => (
                <div key={e.id} className="bg-white rounded-lg border border-stone-200 p-3 flex items-center gap-3">
                  <span className="text-emerald-500">✓</span>
                  <div>
                    <p className="text-sm font-medium text-stone-900">{e.track?.title}</p>
                    <p className="text-xs text-stone-400">
                      Completed {e.completed_at ? new Date(e.completed_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
