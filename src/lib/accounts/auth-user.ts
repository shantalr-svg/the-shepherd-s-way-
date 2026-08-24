interface InternalAuthUserInput {
  email: string
  password: string
  fullName: string
}

interface SecuredProfileInput {
  fullName: string
  phone: string
  role: 'admin' | 'discipler' | 'disciple'
}

interface SecuredProfileUpdate {
  full_name: string
  phone: string
  email: null
  role: SecuredProfileInput['role']
  must_change_password: true
  is_active: true
}

interface AuthAdminClient {
  createUser(attributes: {
    email: string
    password: string
    email_confirm: true
    user_metadata: { full_name: string }
  }): Promise<{
    data: { user: { id: string } | null }
    error: Error | null
  }>
}

export async function createConfirmedInternalAuthUser(
  admin: AuthAdminClient,
  input: InternalAuthUserInput,
): Promise<{ authId: string }> {
  const { data, error } = await admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  })
  if (error) throw error
  if (!data.user) throw new Error('Auth user creation failed.')
  return { authId: data.user.id }
}

export function createSecuredProfileUpdate(
  input: SecuredProfileInput,
  actorProfileId: string,
): SecuredProfileUpdate & { created_by: string }
export function createSecuredProfileUpdate(
  input: SecuredProfileInput,
): SecuredProfileUpdate
export function createSecuredProfileUpdate(
  input: SecuredProfileInput,
  actorProfileId?: string,
): SecuredProfileUpdate | (SecuredProfileUpdate & { created_by: string }) {
  const update: SecuredProfileUpdate = {
    full_name: input.fullName,
    phone: input.phone,
    email: null,
    role: input.role,
    must_change_password: true,
    is_active: true,
  }
  return actorProfileId ? { ...update, created_by: actorProfileId } : update
}
