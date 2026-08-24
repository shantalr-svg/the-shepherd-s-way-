# No-Cost Phone-Number Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users sign in with Zimbabwean phone numbers and passwords without a paid SMS provider by mapping each normalized phone number to a deterministic, internal Supabase email identifier.

**Architecture:** `src/lib/phone.ts` owns both Zimbabwean phone normalization and construction of the Auth-only email/password credentials. The login page and both trusted provisioning runtimes consume that shared function, while profiles and API responses continue to expose only real phone numbers. Supabase Email auth stays enabled, Phone auth stays disabled, and public signup stays disabled.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript 5, Supabase JS 2.108.2, Node test runner, ESLint

**Spec:** `docs/superpowers/specs/2026-08-21-phone-auth-bootstrap-design.md`

## Global Constraints

- Users enter a Zimbabwean phone number and password; no email field is added to the UI.
- Normalize supported inputs to `+2637XXXXXXXX` before deriving an Auth identifier.
- Derive `2637XXXXXXXX@phone.invalid`; never return or display this value in administrator APIs, credential reports, profile pages, or audit details.
- Create Supabase Auth users with `email_confirm: true`; never use `phone_confirm` in the no-cost phase.
- Store the real normalized number in `profiles.phone` and clear the synthetic address from `profiles.email` after the Auth trigger creates the profile.
- Keep Supabase Email auth enabled, native Phone auth disabled, and public signup disabled.
- Preserve temporary-password replacement, rollback, audit, five-admin, profile-protection, and task-update behavior.
- Do not add an SMS dependency, a new database migration, or production contact data to Git.

---

## File Structure

- `src/lib/phone.ts`: normalize and format Zimbabwean numbers; produce the internal Supabase email/password credentials.
- `src/lib/phone-login.ts`: send derived email/password credentials through the Supabase password-login boundary and surface Auth errors.
- `src/app/login/page.tsx`: collect a phone number and password, then send derived email/password credentials to Supabase.
- `src/lib/accounts/provision.ts`: validate account requests and pass an internal email identifier to the Auth dependency without exposing it in results or audit records.
- `src/lib/accounts/auth-user.ts`: create a confirmed internal-email Auth user through an injected Supabase Admin boundary.
- `src/lib/accounts/runtime.ts`: create confirmed email/password Auth users and clear synthetic profile email values.
- `scripts/bootstrap-users.ts`: use the same confirmed email/password Auth creation path for the private 20-user bootstrap.
- `tests/phone.test.ts`: unit coverage for normalization and deterministic credential construction.
- `tests/phone-login.test.ts`: behavioral coverage for the exact Supabase login payload and Auth error propagation.
- `tests/auth-user.test.ts`: behavioral coverage for confirmed internal-email Auth creation and error propagation.
- `tests/provision-account.test.ts`: provisioning contract, output secrecy, rollback, and audit coverage.
- `README.md`: exact hosted Supabase settings, environment variables, migration state, bootstrap sequence, and future SMS upgrade note.

---

### Task 1: Internal Auth credentials and login

**Files:**
- Modify: `src/lib/phone.ts`
- Create: `src/lib/phone-login.ts`
- Modify: `src/app/login/page.tsx`
- Test: `tests/phone.test.ts`
- Test: `tests/phone-login.test.ts`

**Interfaces:**
- Consumes: `normalizeZimbabwePhone(input: string): string`
- Produces: `createPhonePasswordCredentials(phone: string, password: string): { email: string; password: string }`
- Produces: `signInWithPhonePassword(auth, phone, password): Promise<void>`

- [ ] **Step 1: Write the failing credential-mapping test**

Add the new export to the import in `tests/phone.test.ts`, then add:

```ts
test('builds deterministic internal Auth credentials without changing the password', () => {
  assert.deepEqual(
    createPhonePasswordCredentials('077 282 9203', 'TemporaryPass1!xx'),
    {
      email: '263772829203@phone.invalid',
      password: 'TemporaryPass1!xx',
    },
  )
})
```

- [ ] **Step 2: Run the focused test and verify the missing export failure**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/phone.test.ts
```

Expected: FAIL because `createPhonePasswordCredentials` is not exported.

- [ ] **Step 3: Implement the deterministic credential constructor**

Add to `src/lib/phone.ts`:

```ts
const PHONE_AUTH_DOMAIN = 'phone.invalid'

export function createPhonePasswordCredentials(
  phone: string,
  password: string,
): { email: string; password: string } {
  const normalizedPhone = normalizeZimbabwePhone(phone)
  return {
    email: `${normalizedPhone.slice(1)}@${PHONE_AUTH_DOMAIN}`,
    password,
  }
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run the Step 2 command.

Expected: all `tests/phone.test.ts` cases PASS.

- [ ] **Step 5: Add a failing behavior test for the login boundary**

Create `tests/phone-login.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import { signInWithPhonePassword } from '../src/lib/phone-login.ts'

test('signs in with the derived internal email and unchanged password', async () => {
  let received: unknown
  const auth = {
    signInWithPassword: async (credentials: unknown) => {
      received = credentials
      return { error: null }
    },
  }

  await signInWithPhonePassword(auth, '077 282 9203', 'TemporaryPass1!xx')

  assert.deepEqual(received, {
    email: '263772829203@phone.invalid',
    password: 'TemporaryPass1!xx',
  })
})

test('surfaces the Supabase password-login error', async () => {
  const expected = new Error('Invalid login credentials')
  const auth = {
    signInWithPassword: async () => ({ error: expected }),
  }

  await assert.rejects(
    signInWithPhonePassword(auth, '0772829203', 'wrong-password'),
    expected,
  )
})
```

- [ ] **Step 6: Run the regression and verify it fails on the old phone Auth payload**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/phone-login.test.ts
```

Expected: FAIL because `src/lib/phone-login.ts` does not exist.

- [ ] **Step 7: Implement the tested login boundary and update the login page**

Create `src/lib/phone-login.ts` with a structural Auth interface, call `createPhonePasswordCredentials`, await `signInWithPassword`, and throw the returned error when it is non-null.

In `src/app/login/page.tsx`, replace the normalization import and Auth call with:

```ts
import { signInWithPhonePassword } from '@/lib/phone-login'

// Inside login():
await signInWithPhonePassword(createClient().auth, phone, password)
```

Keep the existing phone input, password input, loading/error handling, and dashboard redirect unchanged.

- [ ] **Step 8: Run focused tests and TypeScript**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/phone.test.ts tests/phone-login.test.ts
npx.cmd tsc --noEmit
```

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 9: Commit the login boundary**

```powershell
git add -- src/lib/phone.ts src/lib/phone-login.ts src/app/login/page.tsx tests/phone.test.ts tests/phone-login.test.ts
git commit -m "feat: map phone login to internal auth identifiers"
```

---

### Task 2: Trusted account provisioning

**Files:**
- Modify: `src/lib/accounts/provision.ts`
- Create: `src/lib/accounts/auth-user.ts`
- Modify: `src/lib/accounts/runtime.ts`
- Modify: `scripts/bootstrap-users.ts`
- Test: `tests/auth-user.test.ts`
- Test: `tests/provision-account.test.ts`

**Interfaces:**
- Consumes: `createPhonePasswordCredentials(phone, password)` from Task 1
- Changes: `AccountDependencies.createAuthUser(input: { email: string; password: string; fullName: string }): Promise<{ authId: string }>`
- Preserves: `ProvisionAccountResult` with only `profileId`, `authId`, `normalizedPhone`, and `temporaryPassword`

- [ ] **Step 1: Tighten the provisioning test around the Auth input and public result**

In the first test in `tests/provision-account.test.ts`, add:

```ts
assert.deepEqual(events[0]?.value, {
  email: '263772829203@phone.invalid',
  password: 'TemporaryPass1!xx',
  fullName: 'Shantal Renco',
})
assert.doesNotMatch(JSON.stringify(result), /phone\.invalid/)
```

Keep the existing assertions proving the audit event contains no password.

- [ ] **Step 2: Run the provisioning test and verify the contract failure**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/provision-account.test.ts
```

Expected: FAIL because `createAuthUser` still receives `phone`.

- [ ] **Step 3: Change the dependency contract and provisioning call**

In `src/lib/accounts/provision.ts`:

```ts
import {
  createPhonePasswordCredentials,
  normalizeZimbabwePhone,
} from '../phone.ts'

// AccountDependencies
createAuthUser(input: {
  email: string
  password: string
  fullName: string
}): Promise<{ authId: string }>

// provisionAccount, after generating temporaryPassword
const credentials = createPhonePasswordCredentials(
  normalizedPhone,
  temporaryPassword,
)
const { authId } = await dependencies.createAuthUser({
  ...credentials,
  fullName,
})
```

Do not add the internal identifier to `ProvisionAccountResult` or audit `details`.

- [ ] **Step 4: Run the provisioning test and verify it passes**

Run the Step 2 command.

Expected: all provisioning, rollback, duplicate, and password-reset tests PASS.

- [ ] **Step 5: Add a failing behavior test for confirmed Auth creation**

Create `tests/auth-user.test.ts` with a fake Admin boundary that records its input, then assert:

```ts
assert.deepEqual(received, {
  email: '263772829203@phone.invalid',
  password: 'TemporaryPass1!xx',
  email_confirm: true,
  user_metadata: { full_name: 'Shantal Renco' },
})
assert.deepEqual(result, { authId: 'auth-1' })
```

Add separate cases proving a returned Auth error is thrown and a missing `data.user` throws `Auth user creation failed.`

- [ ] **Step 6: Run the source regression and verify it fails**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/auth-user.test.ts
```

Expected: FAIL because `src/lib/accounts/auth-user.ts` does not exist.

- [ ] **Step 7: Implement and use the shared confirmed-Auth-user function**

Create `src/lib/accounts/auth-user.ts` with `createConfirmedInternalAuthUser(admin, input)`. It must call `admin.createUser` with the exact payload asserted in Step 5, throw any returned error, reject a missing user, and return only `{ authId: data.user.id }`.

In `src/lib/accounts/runtime.ts`, replace the Auth creation dependency with:

```ts
createAuthUser: (input) => createConfirmedInternalAuthUser(client.auth.admin, input),
```

Include `email: null` in `secureProfile`'s trusted profile update so the synthetic address is not retained in `profiles.email`.

- [ ] **Step 8: Update the private bootstrap runtime**

In `scripts/bootstrap-users.ts`:

1. Add `email?: string | null` to the local `profiles.Update` type.
2. Change `createAuthUser` to call `createConfirmedInternalAuthUser(client.auth.admin, input)`.
3. Include `email: null` in `secureProfile`'s profile update.

Keep the private CSV columns exactly:

```text
full_name,phone,role,temporary_password
```

- [ ] **Step 9: Run focused account and bootstrap tests**

Run:

```powershell
node --experimental-strip-types --test --test-isolation=none tests/auth-user.test.ts tests/provision-account.test.ts tests/bootstrap-users.test.ts
npx.cmd tsc --noEmit
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 10: Commit trusted provisioning**

```powershell
git add -- src/lib/accounts/auth-user.ts src/lib/accounts/provision.ts src/lib/accounts/runtime.ts scripts/bootstrap-users.ts tests/auth-user.test.ts tests/provision-account.test.ts
git commit -m "feat: provision no-cost phone login accounts"
```

---

### Task 3: Deployment and operator instructions

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Supabase project reference, migrations, `.env.local`, ignored bootstrap input, and the `bootstrap:users` script
- Produces: one authoritative deployment sequence that never instructs an operator to enable native Phone auth in the no-cost phase

- [ ] **Step 1: Replace the template README with the project runbook**

Document these exact sections in `README.md`:

1. Project purpose and role dashboards.
2. Local commands: `npm install`, `npm run dev`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
3. Required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Migration order: `20260623_initial_schema.sql`, `20260820_security_patch_1.sql`, `20260821_phone_auth_and_account_admin.sql`.
5. Hosted Auth settings: Email enabled, Phone disabled, public signup disabled.
6. Internal mapping example: `+263772829203 -> 263772829203@phone.invalid`, explicitly labeled non-contact and Auth-only.
7. Private bootstrap validation and execution commands with absolute `--input` and `--output` paths.
8. One-time credential handling and deletion warning.
9. Future native phone/SMS migration note.

Do not include keys, real contact lists, generated passwords, or a real credential-output path.

- [ ] **Step 2: Review the runbook against the approved settings**

Confirm manually that Email is documented as enabled, Phone and public signup as disabled, `phone.invalid` as Auth-only, all three environment variables are listed, and no real secrets or contacts appear. Human-facing prose intentionally has no source-text unit test.

- [ ] **Step 3: Run full static checks**

Run:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
```

Expected: test PASS; TypeScript and lint exit 0.

- [ ] **Step 4: Commit the runbook**

```powershell
git add -- README.md
git commit -m "docs: document no-cost phone login deployment"
```

---

### Task 4: Release verification and handoff

**Files:**
- Verify only; modify files only to correct a demonstrated failure

**Interfaces:**
- Consumes: completed Tasks 1-3
- Produces: a verified branch ready for push, deployment-variable setup, and separately confirmed creation of the 20 real accounts

- [ ] **Step 1: Run the full automated test suite**

```powershell
npm.cmd test
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the TypeScript and lint release gates**

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 4: Inspect the final branch diff and secret boundaries**

```powershell
git status --short
git diff --check HEAD~3..HEAD
git grep -n "phone_confirm: true"
git grep -n "phone.invalid"
git status --short --ignored work outputs .env.local
```

Expected:

- tracked worktree is clean;
- no whitespace errors;
- no production runtime contains `phone_confirm: true`;
- `phone.invalid` appears only in the helper, tests, spec, plan, and README;
- `.env.local`, production bootstrap input, and credential outputs remain ignored.

- [ ] **Step 5: Validate the private bootstrap input without creating accounts**

```powershell
npm.cmd run bootstrap:users -- --input "C:\absolute\private\bootstrap-users.production.json" --validate-only
```

Expected: `Validated 20 users: 2 admins and 18 disciplers.` No Auth users or passwords are created.

- [ ] **Step 6: Report the deployment boundary**

Report:

- exact commits and files changed;
- test, TypeScript, lint, and build evidence;
- no database migration is required for this adjustment;
- Supabase must remain Email enabled, Phone disabled, public signup disabled;
- the branch may be pushed under the existing authorization;
- creating the 20 external Auth accounts and their one-time passwords is a separate, sensitive action that requires action-time confirmation after deployment credentials are configured.
