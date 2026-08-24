# Phone Authentication and Initial User Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email access with Zimbabwean phone/password authentication, force initial password replacement, enforce a five-administrator limit, and securely provision two administrators plus 18 disciplers.

**Architecture:** Supabase Auth remains the credential authority while `profiles` remains the application authorization authority. Shared phone/account modules provide testable validation, protected Next.js routes perform service-role mutations, database triggers enforce invariants under concurrency, and a local-only bootstrap command reuses the same provisioning service without committing personal data or passwords.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript 5, Supabase JS 2.108.2, PostgreSQL migrations, Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-21-phone-auth-bootstrap-design.md`

## Global Constraints

- Users sign in with Zimbabwean phone numbers normalized to E.164.
- Public signup remains disabled; only trusted server workflows create accounts.
- Temporary passwords are generated server-side, returned once, and never logged or stored in readable form.
- Every provisioned account has `must_change_password = true` until the user replaces it.
- Either administrator may add another administrator; the database rejects a sixth active administrator.
- Production contacts, credentials, service keys, and bootstrap output never enter Git history.
- Supabase service-role access remains server-only.
- Existing role dashboards and discipleship workflows remain operational.
- SMS and WhatsApp OTP are outside this phase.

## File Structure

- `src/lib/phone.ts`: Zimbabwean phone normalization and display formatting.
- `src/lib/password.ts`: password policy and cryptographic temporary-password generation.
- `src/lib/supabase/admin.ts`: server-only service-role Supabase client.
- `src/lib/accounts/types.ts`: account-management request/response contracts.
- `src/lib/accounts/provision.ts`: reusable create/reset/activate account operations with dependency injection.
- `src/app/api/admin/users/route.ts`: authenticated account creation endpoint.
- `src/app/api/admin/users/[profileId]/password/route.ts`: authenticated temporary-password reset endpoint.
- `src/app/api/admin/users/[profileId]/status/route.ts`: activation endpoint.
- `src/app/initial-password/page.tsx`: mandatory first-login password replacement.
- `src/components/InitialPasswordForm.tsx`: client password-update form.
- `src/components/AdminDashboard.tsx`: phone-based account-management interface.
- `scripts/bootstrap-users.ts`: local-only 20-user provisioning command.
- `scripts/bootstrap-users.example.json`: non-production input shape documentation.
- `supabase/migrations/20260821_phone_auth_and_account_admin.sql`: account lifecycle, audit, protected fields, and admin-cap migration.
- `tests/*.test.ts` and `tests/*.test.mjs`: behavior and security regression coverage.

---

### Task 1: Establish the TypeScript Test Harness and Phone Utilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/phone.ts`
- Create: `tests/phone.test.ts`

**Interfaces:**
- Produces: `normalizeZimbabwePhone(input: string): string`
- Produces: `formatZimbabwePhone(input: string): string`
- Consumers: login, administrator forms, provisioning service, and bootstrap command.

- [ ] **Step 1: Add the test runner dependency and script**

Run:

```powershell
npm.cmd install --save-dev tsx
```

Set the package script to:

```json
"test": "tsx --test tests/**/*.test.ts tests/**/*.test.mjs"
```

- [ ] **Step 2: Write failing phone-normalization tests**

Create `tests/phone.test.ts` with table-driven assertions covering:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatZimbabwePhone, normalizeZimbabwePhone } from '../src/lib/phone'

test('normalizes supported Zimbabwean mobile formats', () => {
  for (const input of ['0772829203', '263772829203', '+263772829203', '077 282 9203']) {
    assert.equal(normalizeZimbabwePhone(input), '+263772829203')
  }
})

test('rejects malformed or non-Zimbabwean numbers', () => {
  for (const input of ['', '772829203', '+27111222333', '07728abc03', '07728292034']) {
    assert.throws(() => normalizeZimbabwePhone(input), /Zimbabwean mobile number/)
  }
})

test('formats normalized numbers for people', () => {
  assert.equal(formatZimbabwePhone('+263772829203'), '+263 77 282 9203')
})
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- tests/phone.test.ts
```

Expected: FAIL because `src/lib/phone.ts` does not exist.

- [ ] **Step 4: Implement strict normalization**

Create `src/lib/phone.ts` with a single sanitation path that removes spaces, hyphens, and parentheses; converts `0XXXXXXXXX` and `263XXXXXXXXX` to `+263XXXXXXXXX`; and accepts only `^\+2637\d{8}$` after normalization.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- tests/phone.test.ts
npm.cmd exec tsc -- --noEmit
git add -- package.json package-lock.json src/lib/phone.ts tests/phone.test.ts
git commit -m "feat: add Zimbabwean phone normalization"
```

Expected: phone tests and TypeScript pass.

---

### Task 2: Add Account-Lifecycle Database Invariants

**Files:**
- Create: `supabase/migrations/20260821_phone_auth_and_account_admin.sql`
- Create: `tests/account-schema-security.test.mjs`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces profile columns: `must_change_password`, `is_active`, `created_by`, `password_initialized_at`, `deactivated_at`.
- Produces table: `admin_audit_log`.
- Produces function: `complete_initial_password_change()`.
- Produces triggers: protected lifecycle fields and concurrent five-admin cap.
- Consumers: server routes, routing guards, initial-password form, and admin dashboard.

- [ ] **Step 1: Write failing migration-regression tests**

Create `tests/account-schema-security.test.mjs` that reads the migration and asserts:

```js
assert.match(sql, /must_change_password\s+BOOLEAN\s+NOT NULL/i)
assert.match(sql, /is_active\s+BOOLEAN\s+NOT NULL/i)
assert.match(sql, /CREATE TABLE public\.admin_audit_log/i)
assert.match(sql, /pg_advisory_xact_lock/i)
assert.match(sql, /active administrator limit is five/i)
assert.match(sql, /complete_initial_password_change/i)
assert.match(sql, /must_change_password.*IS DISTINCT FROM/is)
assert.match(sql, /REVOKE.*admin_audit_log/is)
```

- [ ] **Step 2: Run the schema test and verify RED**

Run:

```powershell
node --test --test-isolation=none tests/account-schema-security.test.mjs
```

Expected: FAIL because the migration is missing.

- [ ] **Step 3: Implement the migration**

Create the migration with these concrete rules:

```sql
ALTER TABLE public.profiles
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN password_initialized_at TIMESTAMPTZ,
  ADD COLUMN deactivated_at TIMESTAMPTZ;

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'account_created', 'admin_promoted', 'role_changed',
    'password_reset', 'account_activated', 'account_deactivated',
    'initial_password_changed'
  )),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Implement a `BEFORE INSERT OR UPDATE` profiles trigger that acquires `pg_advisory_xact_lock(hashtext('profiles-active-admin-limit'))` before accepting a transition into active `admin`; count other active admins and raise `active administrator limit is five` when the count is already five.

Replace `protect_profile_security_fields()` so lifecycle fields are protected from ordinary clients while authenticated admins retain approved management ability and the service role can complete server operations. Add an append-only audit policy and revoke client update/delete permissions. Implement `complete_initial_password_change()` as a security-definer function that updates only the authenticated caller and inserts the non-secret audit event.

Retire the email invitation table and email-specific trigger lookup only after the new server provisioning path no longer depends on it. Preserve secure default `disciple` role creation for raw Auth users.

- [ ] **Step 4: Update TypeScript database types**

Extend `Profile` with the five lifecycle fields and add:

```ts
export interface AdminAuditLog {
  id: string
  actor_profile_id: string | null
  target_profile_id: string | null
  action: 'account_created' | 'admin_promoted' | 'role_changed' |
    'password_reset' | 'account_activated' | 'account_deactivated' |
    'initial_password_changed'
  details: Record<string, unknown>
  created_at: string
}
```

- [ ] **Step 5: Verify migration behavior and commit**

Run:

```powershell
node --test --test-isolation=none tests/account-schema-security.test.mjs
npm.cmd exec tsc -- --noEmit
git diff --check
git add -- supabase/migrations/20260821_phone_auth_and_account_admin.sql tests/account-schema-security.test.mjs src/types/database.ts
git commit -m "feat: secure phone account lifecycle"
```

If a local Supabase stack is available, additionally run `supabase db reset` and verify the sixth-admin transaction fails. If it is unavailable, record that integration check for Task 8 before production deployment.

---

### Task 3: Build Server-Only Password and Provisioning Services

**Files:**
- Create: `src/lib/password.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/accounts/types.ts`
- Create: `src/lib/accounts/provision.ts`
- Create: `tests/password.test.ts`
- Create: `tests/provision-account.test.ts`

**Interfaces:**
- Produces: `generateTemporaryPassword(randomBytes?: (size: number) => Uint8Array): string`
- Produces: `validateReplacementPassword(password: string): string | null`
- Produces: `ProvisionAccountInput { fullName: string; phone: string; role: 'admin' | 'discipler' | 'disciple' }`
- Produces: `ProvisionAccountResult { profileId: string; authId: string; normalizedPhone: string; temporaryPassword: string }`
- Produces: `provisionAccount(input, dependencies): Promise<ProvisionAccountResult>`
- Produces: `resetAccountPassword(profileId, dependencies): Promise<{ temporaryPassword: string }>`
- Consumers: admin APIs and bootstrap command.

- [ ] **Step 1: Write failing password tests**

Test that generated passwords are at least 16 characters, contain upper/lowercase letters, digits, and symbols, and produce deterministic output with injected bytes. Test replacement rejection for fewer than 12 characters or missing character classes.

- [ ] **Step 2: Write failing provisioning-service tests**

Use dependency fakes for Auth and profile writes. Cover:

```ts
test('creates confirmed phone auth user then secured profile and audit event', async () => {})
test('deletes the auth user when profile creation fails', async () => {})
test('never sends the temporary password to logs or audit details', async () => {})
test('reports duplicate normalized phone before creating auth state', async () => {})
test('propagates the database five-admin rejection', async () => {})
test('reset marks the account for forced change and returns a new password once', async () => {})
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/password.test.ts tests/provision-account.test.ts
```

Expected: FAIL because the service modules are missing.

- [ ] **Step 4: Implement server-only modules**

`src/lib/supabase/admin.ts` must start with:

```ts
import 'server-only'
```

It creates a Supabase client using validated `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, with session persistence disabled. `provisionAccount` normalizes input, checks duplicates, generates a password, creates a phone-confirmed Auth user, updates the trigger-created profile with the requested role/lifecycle fields, inserts an audit event, and removes the Auth user if the profile stage fails.

`resetAccountPassword` looks up the target Auth ID, generates a password, updates Auth, sets `must_change_password = true`, clears `password_initialized_at`, and records `password_reset` without including the password.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- tests/password.test.ts tests/provision-account.test.ts
npm.cmd exec tsc -- --noEmit
git add -- src/lib/password.ts src/lib/supabase/admin.ts src/lib/accounts/types.ts src/lib/accounts/provision.ts tests/password.test.ts tests/provision-account.test.ts
git commit -m "feat: add secure account provisioning service"
```

---

### Task 4: Expose Protected Administrator Account APIs

**Files:**
- Create: `src/lib/accounts/authorize-admin.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[profileId]/password/route.ts`
- Create: `src/app/api/admin/users/[profileId]/status/route.ts`
- Remove: `src/app/api/invite/route.ts`
- Create: `tests/admin-account-routes.test.ts`

**Interfaces:**
- Consumes account services from Task 3.
- Produces `POST /api/admin/users` with `ProvisionAccountInput` and one-time `ProvisionAccountResult`.
- Produces `POST /api/admin/users/:profileId/password` with one-time temporary password.
- Produces `PATCH /api/admin/users/:profileId/status` with `{ isActive: boolean }`.
- Produces `requireAdmin()` returning authenticated user/profile IDs or a standardized 401/403 response.

- [ ] **Step 1: Write failing route tests**

Cover unauthenticated 401, non-admin 403, invalid JSON 400, invalid phone/role 400, successful provisioning 201, sixth-admin 409, password reset 200, and activation update 200. Inject authorization and account service dependencies into exported route factories so tests exercise route behavior without live Supabase.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/admin-account-routes.test.ts
```

Expected: FAIL because the route factories do not exist.

- [ ] **Step 3: Implement authorization and routes**

Each production handler calls the factory with real dependencies. Responses expose only safe messages. Map duplicate phone to 409, admin limit to 409, invalid input to 400, missing target to 404, and unexpected failures to a generic 500 while logging only non-secret context.

Remove the email invitation route after the replacement route is working.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- tests/admin-account-routes.test.ts
npm.cmd exec tsc -- --noEmit
git add -- src/lib/accounts/authorize-admin.ts src/app/api/admin/users src/app/api/invite/route.ts tests/admin-account-routes.test.ts
git commit -m "feat: add protected account administration APIs"
```

---

### Task 5: Replace Email Login and Enforce Initial Password Replacement

**Files:**
- Modify: `src/app/login/page.tsx`
- Delete: `src/app/reset-password/page.tsx`
- Create: `src/app/initial-password/page.tsx`
- Create: `src/components/InitialPasswordForm.tsx`
- Modify: `src/proxy.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/admin/page.tsx`
- Modify: `src/app/dashboard/discipler/page.tsx`
- Modify: `src/app/dashboard/disciple/page.tsx`
- Create: `src/lib/access-state.ts`
- Create: `tests/access-state.test.ts`

**Interfaces:**
- Produces: `resolveAccessDestination(profile): '/login' | '/initial-password' | '/dashboard/admin' | '/dashboard/discipler' | '/dashboard/disciple'`.
- Consumes `normalizeZimbabwePhone` and `validateReplacementPassword`.

- [ ] **Step 1: Write failing routing-policy tests**

Cover missing profile, inactive profile, forced password change for every role, and normal role destinations. The forced-change decision must take precedence over role routing.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/access-state.test.ts
```

Expected: FAIL because `resolveAccessDestination` is missing.

- [ ] **Step 3: Implement phone login**

Replace email state and `signInWithPassword({ email, password })` with phone state, normalized input, and:

```ts
await supabase.auth.signInWithPassword({ phone: normalizedPhone, password })
```

Remove forgot-email views and link users to an administrator for password resets.

- [ ] **Step 4: Implement forced password replacement**

The page verifies an authenticated session and redirects users who do not require replacement. The client form validates confirmation and policy, calls `auth.updateUser({ password })`, calls `rpc('complete_initial_password_change')`, signs out on inconsistent failure, and redirects through `/dashboard` on success.

Update proxy and all dashboard server pages to deny inactive profiles and route forced-change users before rendering protected data.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- tests/access-state.test.ts tests/phone.test.ts tests/password.test.ts
npm.cmd exec tsc -- --noEmit
git add -- src/app/login/page.tsx src/app/reset-password/page.tsx src/app/initial-password/page.tsx src/components/InitialPasswordForm.tsx src/proxy.ts src/app/dashboard src/lib/access-state.ts tests/access-state.test.ts
git commit -m "feat: add phone login and forced password change"
```

---

### Task 6: Build the Administrator User-Management Interface

**Files:**
- Modify: `src/components/AdminDashboard.tsx`
- Modify: `src/app/dashboard/admin/page.tsx`
- Create: `src/components/OneTimeCredential.tsx`
- Create: `src/lib/accounts/client.ts`
- Create: `tests/account-client.test.ts`

**Interfaces:**
- Produces typed client calls: `createManagedUser`, `resetManagedUserPassword`, `setManagedUserActive`.
- Produces `OneTimeCredential` accepting `{ fullName, phone, temporaryPassword, onClose }`.
- Consumes admin API contracts and profile lifecycle fields.

- [ ] **Step 1: Write failing account-client tests**

Verify request paths/methods, safe JSON parsing, non-JSON failure handling, and that temporary credentials are returned only from successful calls.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/account-client.test.ts
```

Expected: FAIL because the client module is missing.

- [ ] **Step 3: Implement account client and one-time credential component**

The one-time view includes a copy button and builds this message entirely in browser state:

```text
Welcome to The Shepherd's Way.
Phone: <normalized phone>
Temporary password: <temporary password>
Sign in and choose a new password immediately.
```

It has no persistence, analytics, console logging, or URL parameters.

- [ ] **Step 4: Replace email invitation UI**

Use full name, phone, and role fields. Include `admin` only while the server-reported active admin count is below five; still handle a database rejection. Show active state and initial-password state. Add reset and activate/deactivate controls with confirmations and visible errors.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- tests/account-client.test.ts
npm.cmd exec tsc -- --noEmit
npm.cmd run lint -- src/components/AdminDashboard.tsx src/components/OneTimeCredential.tsx src/lib/accounts/client.ts
git add -- src/components/AdminDashboard.tsx src/components/OneTimeCredential.tsx src/app/dashboard/admin/page.tsx src/lib/accounts/client.ts tests/account-client.test.ts
git commit -m "feat: add phone user administration interface"
```

---

### Task 7: Create the Private Initial-User Bootstrap

**Files:**
- Create: `scripts/bootstrap-users.ts`
- Create: `scripts/bootstrap-users.example.json`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `tests/bootstrap-users.test.ts`
- Local-only create during operation: `work/bootstrap-users.production.json`
- Local-only output during operation: `outputs/initial-user-credentials.csv`

**Interfaces:**
- Consumes `provisionAccount`, phone normalization, and service-role environment validation.
- Input records: `{ fullName: string; phone: string; role: 'admin' | 'discipler' }[]`.
- Produces one-time CSV columns: `full_name,phone,role,temporary_password`.

- [ ] **Step 1: Write failing bootstrap validation tests**

Cover exactly 20 records, exactly two admins, exactly 18 disciplers, normalized-phone uniqueness, invalid roles, no password fields in input, and idempotent reporting of pre-existing accounts.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/bootstrap-users.test.ts
```

Expected: FAIL because the bootstrap module is missing.

- [ ] **Step 3: Implement the bootstrap command**

Add package script:

```json
"bootstrap:users": "tsx scripts/bootstrap-users.ts"
```

Require `--input <absolute path>` and `--output <absolute path>`. Refuse an output path inside the repository unless it is under an ignored `outputs/` directory. Validate all records before writes. Process sequentially for clear recovery reporting. Open the output file only after validation; use exclusive creation so an existing credential report is never overwritten.

The example JSON uses fictional names and numbers. Add these ignore rules:

```gitignore
work/bootstrap-users*.json
outputs/*credentials*.csv
```

- [ ] **Step 4: Create the production input locally from reviewed screenshots**

Construct the local ignored input with the two approved administrators and the 18 reviewed disciplers, using the selected first mobile number for multi-number contacts and the mobile rather than landline for Daniel. Run validation-only mode and manually compare all 20 normalized records with the source screenshots before any remote creation.

- [ ] **Step 5: Verify GREEN and commit only non-sensitive files**

Run:

```powershell
npm.cmd test -- tests/bootstrap-users.test.ts
npm.cmd exec tsc -- --noEmit
git status --short
git add -- scripts/bootstrap-users.ts scripts/bootstrap-users.example.json tests/bootstrap-users.test.ts .gitignore package.json package-lock.json
git commit -m "feat: add private initial user bootstrap"
```

Expected: production input and credential output do not appear in `git status`.

---

### Task 8: Documentation, Full Verification, and Deployment Readiness

**Files:**
- Replace: `README.md`
- Modify: `tests/security-patch.test.mjs`
- Modify: relevant source files only when full verification exposes scoped defects.

**Interfaces:**
- Documents local setup, Supabase project setup, migrations, Vercel variables, account bootstrap, credential deletion, and SMS upgrade path.

- [ ] **Step 1: Update security regression expectations**

Replace email-invitation assertions with phone-provisioning assertions. Retain checks for profile protection, task restrictions, explicit environment validation, mutation error handling, and absence of placeholder credentials.

- [ ] **Step 2: Replace the generic README**

Document exact commands:

```powershell
npm.cmd install
npm.cmd test
npm.cmd exec tsc -- --noEmit
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
npm.cmd run build
```

List required environment variables and explicitly label `SUPABASE_SERVICE_ROLE_KEY` server-only. Document that production bootstrap input/output are ignored and must be deleted after distribution.

- [ ] **Step 3: Run full fresh verification**

Run:

```powershell
npm.cmd test
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
$env:NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='build-validation-key'
$env:SUPABASE_SERVICE_ROLE_KEY='build-validation-service-key'
npm.cmd run build
git diff --check
git status --short
```

Expected: all tests, TypeScript, lint, and build pass; only planned files are modified. If Windows blocks a subprocess with `EPERM`, distinguish that environmental failure from compilation output and rerun in CI/Vercel before publication.

- [ ] **Step 4: Verify migrations against Supabase**

When local Docker/Supabase is available:

```powershell
supabase db reset
```

Before remote application:

```powershell
supabase db push --dry-run
```

Inspect the exact migration list. Apply with `supabase db push` only after the linked project identity is confirmed.

- [ ] **Step 5: Commit documentation and push branch**

```powershell
git add -- README.md tests/security-patch.test.mjs
git commit -m "docs: add phone auth deployment runbook"
git push -u origin codex/phone-auth-bootstrap
```

Create one draft pull request targeting the repository's default branch after Security Patch 1 is merged. Include verification evidence, migration order, environment variables, and the manual Supabase Auth setting for phone authentication/public signup.

---

### Task 9: Supabase, Vercel, and Initial Production Bootstrap

**Files:**
- No tracked source changes unless deployment exposes a reproducible defect.
- Local-only: Supabase/Vercel authenticated state and ignored bootstrap files.

**Interfaces:**
- Consumes the verified branch, three deployment environment variables, linked Supabase project, and reviewed local 20-user input.
- Produces the deployed application and one-time credential report.

- [ ] **Step 1: Create or select the Supabase project with the user**

Confirm project name, organization, region, pricing choice, and database password before submitting any account-level form. Record no password or service key in chat, Git, command output, or screenshots.

- [ ] **Step 2: Configure Auth and apply migrations**

Enable phone authentication, keep public self-registration disabled, confirm the exact linked project, run the dry run, then apply migrations. Inspect the resulting profiles, audit log, triggers, policies, and seeded tracks.

- [ ] **Step 3: Configure Vercel Preview and Production**

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in both environments, then trigger fresh deployments so changed variables take effect.

- [ ] **Step 4: Run the 20-user bootstrap once**

Execute the reviewed local input against the confirmed project. Stop on any partial failure and reconcile created accounts before retrying. Never reset existing users silently.

- [ ] **Step 5: Perform controlled smoke tests and hand off credentials**

Verify both administrators can sign in, are forced to replace passwords, and can access administration. Verify one discipler completes the same flow and reaches only the discipler dashboard. Verify a test administrator can be added below the cap and that the sixth is rejected in a non-production test setup.

Deliver the credential report privately to the user, remind them to send credentials individually through WhatsApp, and delete the local report only after the user confirms distribution is complete.
