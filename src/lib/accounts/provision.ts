import { generateTemporaryPassword } from '../password.ts'
import {
  createPhonePasswordCredentials,
  normalizeZimbabwePhone,
} from '../phone.ts'
import type {
  AccountAuditEvent,
  ProvisionAccountInput,
  ProvisionAccountResult,
} from './types.ts'

export interface AccountDependencies {
  findProfileByPhone(phone: string): Promise<{ profileId: string } | null>
  createAuthUser(input: {
    email: string
    password: string
    fullName: string
  }): Promise<{ authId: string }>
  secureProfile(
    authId: string,
    input: ProvisionAccountInput & { phone: string },
  ): Promise<{ profileId: string }>
  deleteProfile(profileId: string): Promise<void>
  deleteAuthUser(authId: string): Promise<void>
  recordAudit(event: AccountAuditEvent): Promise<void>
  findProfileById(
    profileId: string,
  ): Promise<{ authId: string; isActive: boolean } | null>
  updateAuthPassword(authId: string, password: string): Promise<void>
  markPasswordResetRequired(profileId: string): Promise<void>
  generatePassword(): string
}

export async function provisionAccount(
  input: ProvisionAccountInput,
  dependencies: AccountDependencies,
): Promise<ProvisionAccountResult> {
  const fullName = input.fullName.trim()
  if (fullName.length < 2) throw new Error('A full name is required.')
  if (!['admin', 'discipler', 'disciple'].includes(input.role)) {
    throw new Error('The selected account role is invalid.')
  }

  const normalizedPhone = normalizeZimbabwePhone(input.phone)
  if (await dependencies.findProfileByPhone(normalizedPhone)) {
    throw new Error('An account with this phone number already exists.')
  }

  const temporaryPassword = dependencies.generatePassword()
  const credentials = createPhonePasswordCredentials(
    normalizedPhone,
    temporaryPassword,
  )
  const { authId } = await dependencies.createAuthUser({
    ...credentials,
    fullName,
  })

  let securedProfileId: string | null = null
  try {
    const { profileId } = await dependencies.secureProfile(authId, {
      fullName,
      phone: normalizedPhone,
      role: input.role,
    })
    securedProfileId = profileId
    await dependencies.recordAudit({
      actorProfileId: null,
      targetProfileId: profileId,
      action: input.role === 'admin' ? 'admin_promoted' : 'account_created',
      details: { role: input.role, phone: normalizedPhone },
    })
    return { profileId, authId, normalizedPhone, temporaryPassword }
  } catch (error) {
    let rollbackFailed = false
    try {
      if (securedProfileId) await dependencies.deleteProfile(securedProfileId)
    } catch {
      rollbackFailed = true
    }
    try {
      await dependencies.deleteAuthUser(authId)
    } catch {
      rollbackFailed = true
    }
    if (rollbackFailed) {
      throw new Error('Account setup failed and automatic rollback also failed.', {
        cause: error,
      })
    }
    throw error
  }
}

export async function resetAccountPassword(
  profileId: string,
  dependencies: AccountDependencies,
): Promise<{ temporaryPassword: string }> {
  const profile = await dependencies.findProfileById(profileId)
  if (!profile) throw new Error('Account not found.')
  if (!profile.isActive) throw new Error('Inactive accounts cannot reset passwords.')

  const temporaryPassword = dependencies.generatePassword()
  await dependencies.updateAuthPassword(profile.authId, temporaryPassword)
  await dependencies.markPasswordResetRequired(profileId)
  await dependencies.recordAudit({
    actorProfileId: null,
    targetProfileId: profileId,
    action: 'password_reset',
  })
  return { temporaryPassword }
}

export function createDefaultPasswordGenerator(): () => string {
  return () => generateTemporaryPassword()
}
