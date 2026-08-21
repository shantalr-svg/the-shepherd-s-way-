import type { ProvisionAccountInput, ProvisionAccountResult } from './types.ts'

type Fetcher = typeof fetch

async function requestJson<T>(fetcher: Fetcher, url: string, init: RequestInit): Promise<T> {
  const response = await fetcher(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  const body = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? 'Account request failed.')
  return body as T
}

export function createAccountClient(fetcher: Fetcher = fetch) {
  return {
    createManagedUser: (input: ProvisionAccountInput) => requestJson<ProvisionAccountResult>(fetcher, '/api/admin/users', { method: 'POST', body: JSON.stringify(input) }),
    resetManagedUserPassword: (profileId: string) => requestJson<{ temporaryPassword: string }>(fetcher, `/api/admin/users/${profileId}/password`, { method: 'POST' }),
    setManagedUserActive: (profileId: string, isActive: boolean) => requestJson<{ success: true }>(fetcher, `/api/admin/users/${profileId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  }
}
