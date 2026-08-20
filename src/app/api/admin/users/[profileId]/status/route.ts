import { adminAccountHandlers } from '@/lib/accounts/runtime'
export async function PATCH(request: Request, context: { params: Promise<{ profileId: string }> }) {
  return adminAccountHandlers.setStatus((await context.params).profileId, request)
}
