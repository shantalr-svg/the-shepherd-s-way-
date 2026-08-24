import { adminAccountHandlers } from '@/lib/accounts/runtime'
export async function POST(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  return adminAccountHandlers.reset((await context.params).profileId)
}
