'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'
import type { ProvisionAccountInput } from '@/lib/accounts/types'
import { createAccountClient } from '@/lib/accounts/client'
import OneTimeCredential from './OneTimeCredential'

export default function AccountManagement({ profiles }: { profiles: Profile[] }) {
  const router = useRouter(); const api = createAccountClient()
  const [form, setForm] = useState<ProvisionAccountInput>({ fullName: '', phone: '', role: 'discipler' })
  const [credential, setCredential] = useState<{ fullName: string; phone: string; temporaryPassword: string } | null>(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const adminCount = profiles.filter((p) => p.role === 'admin' && p.is_active).length
  async function createUser() { setSaving(true); setError(''); try { const result = await api.createManagedUser(form); setCredential({ fullName: form.fullName, phone: result.normalizedPhone, temporaryPassword: result.temporaryPassword }); setForm({ fullName: '', phone: '', role: 'discipler' }); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Account creation failed.') } finally { setSaving(false) } }
  async function reset(profile: Profile) { if (!confirm(`Generate a new temporary password for ${profile.full_name}?`)) return; setError(''); try { const result = await api.resetManagedUserPassword(profile.id); setCredential({ fullName: profile.full_name, phone: profile.phone ?? '', temporaryPassword: result.temporaryPassword }) } catch (e) { setError(e instanceof Error ? e.message : 'Password reset failed.') } }
  async function toggle(profile: Profile) { if (!confirm(`${profile.is_active ? 'Deactivate' : 'Activate'} ${profile.full_name}?`)) return; setError(''); try { await api.setManagedUserActive(profile.id, !profile.is_active); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Status update failed.') } }
  return <div>{credential && <OneTimeCredential {...credential} onClose={() => setCredential(null)} />}{error && <p className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</p>}
    <div className="bg-white border rounded-xl p-4 mb-4 grid md:grid-cols-4 gap-3"><input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="border rounded-lg px-3 py-2" /><input type="tel" placeholder="077 282 9203" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border rounded-lg px-3 py-2" /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ProvisionAccountInput['role'] })} className="border rounded-lg px-3 py-2"><option value="discipler">Discipler</option><option value="disciple">Disciple</option>{adminCount < 5 && <option value="admin">Admin</option>}</select><button disabled={saving || !form.fullName || !form.phone} onClick={createUser} className="bg-emerald-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Creating…' : 'Create account'}</button></div>
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Role / status</th><th className="text-left p-3">Actions</th></tr></thead><tbody>{profiles.map((p) => <tr key={p.id} className="border-b"><td className="p-3">{p.full_name}</td><td className="p-3">{p.phone ?? '—'}</td><td className="p-3">{p.role} · {p.is_active ? (p.must_change_password ? 'temporary password' : 'active') : 'inactive'}</td><td className="p-3 flex gap-2"><button onClick={() => reset(p)} className="underline">Reset password</button><button onClick={() => toggle(p)} className="underline">{p.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
  </div>
}
