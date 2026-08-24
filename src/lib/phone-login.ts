import { createPhonePasswordCredentials } from './phone.ts'

interface PasswordAuthClient {
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ error: Error | null }>
}

export async function signInWithPhonePassword(
  auth: PasswordAuthClient,
  phone: string,
  password: string,
): Promise<void> {
  const credentials = createPhonePasswordCredentials(phone, password)
  const { error } = await auth.signInWithPassword(credentials)
  if (error) throw error
}
