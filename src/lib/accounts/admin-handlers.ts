import type { ProvisionAccountInput, ProvisionAccountResult } from './types.ts'

type Authorization = { ok: true; profileId: string } | { ok: false; status: 401 | 403 }

interface HandlerDependencies {
  authorize(): Promise<Authorization>
  provision(input: ProvisionAccountInput, actorProfileId: string): Promise<ProvisionAccountResult>
  resetPassword(profileId: string, actorProfileId: string): Promise<{ temporaryPassword: string }>
  setActive(profileId: string, isActive: boolean, actorProfileId: string): Promise<void>
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : ''
  if (/already exists|administrator limit is five/i.test(message)) return json({ error: message }, 409)
  if (/required|invalid|Zimbabwean mobile/i.test(message)) return json({ error: message }, 400)
  if (/not found/i.test(message)) return json({ error: 'Account not found.' }, 404)
  return json({ error: 'The account operation failed.' }, 500)
}

export function createAdminAccountHandlers(dependencies: HandlerDependencies) {
  async function authorized() {
    const result = await dependencies.authorize()
    return result.ok ? result : json({ error: result.status === 401 ? 'Unauthorized' : 'Forbidden' }, result.status)
  }

  return {
    async create(request: Request): Promise<Response> {
      const auth = await authorized()
      if (auth instanceof Response) return auth
      let body: unknown
      try { body = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
      try {
        return json(await dependencies.provision(body as ProvisionAccountInput, auth.profileId), 201)
      } catch (error) { return errorResponse(error) }
    },
    async reset(profileId: string): Promise<Response> {
      const auth = await authorized()
      if (auth instanceof Response) return auth
      try { return json(await dependencies.resetPassword(profileId, auth.profileId)) }
      catch (error) { return errorResponse(error) }
    },
    async setStatus(profileId: string, request: Request): Promise<Response> {
      const auth = await authorized()
      if (auth instanceof Response) return auth
      let body: unknown
      try { body = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
      const isActive = (body as { isActive?: unknown })?.isActive
      if (typeof isActive !== 'boolean') return json({ error: 'isActive must be boolean.' }, 400)
      try { await dependencies.setActive(profileId, isActive, auth.profileId); return json({ success: true }) }
      catch (error) { return errorResponse(error) }
    },
  }
}
