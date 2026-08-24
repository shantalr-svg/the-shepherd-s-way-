import { adminAccountHandlers } from '@/lib/accounts/runtime'
export const POST = (request: Request) => adminAccountHandlers.create(request)
