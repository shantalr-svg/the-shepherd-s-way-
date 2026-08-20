# Phone Authentication and Initial User Bootstrap Design

**Date:** 2026-08-21

**Status:** Approved architecture, pending written-spec review

## Purpose

Convert The Shepherd's Way from email-based access to Zimbabwean phone-number and password authentication, establish a reproducible Supabase database, and securely provision the first 20 users: two administrators and 18 disciplers.

This phase does not add disciples or paid SMS delivery. It preserves a clean upgrade path to SMS or WhatsApp one-time-password authentication later.

## Product Decisions

- Users sign in with a Zimbabwean phone number and password.
- Accounts are created only by trusted administrator/server workflows; public signup is disabled.
- New accounts receive cryptographically strong temporary passwords.
- A temporary password is returned once to the creating administrator and is never stored in readable form by the application.
- Users must replace temporary passwords before accessing a role dashboard.
- Either administrator may add another administrator.
- The system allows at most five active administrator profiles.
- The initial population is two administrators and 18 disciplers.
- Disciples will be imported only after administrators and disciplers validate the production system.
- Production contact data, credentials, and generated passwords must never be committed to GitHub.

## Current System and Migration Strategy

The repository already contains a Next.js application, Supabase clients, role dashboards, an initial schema migration, and Security Patch 1. The phone-authentication work will be an additive migration and application change rather than a manual database rebuild.

Migration files remain the authoritative database history. Remote schema changes must be applied with the Supabase CLI after a dry run. The Supabase Dashboard table editor is not used for ad hoc production schema changes.

Security Patch 1 remains a prerequisite because it protects profile authorization fields and task updates. Its email invitation endpoint and invitation table become legacy once phone provisioning replaces that flow; the new migration will remove or retire them safely.

## Data Model

### Profiles

The existing `profiles` table remains the application identity record linked to `auth.users` through `auth_id`. It gains:

- `must_change_password BOOLEAN NOT NULL DEFAULT false`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_by UUID NULL REFERENCES profiles(id)`
- optional timestamps for password initialization and deactivation

Phone numbers are stored only in E.164 format. For this phase, accepted Zimbabwean inputs normalize to `+263` followed by the subscriber number. The database retains a unique constraint on the normalized phone value.

The protected-profile trigger is extended so ordinary users cannot change `role`, `auth_id`, `discipler_id`, `must_change_password`, `is_active`, or `created_by`. Trusted server operations may change these fields through service-role or narrowly scoped security-definer paths.

### Administrator Limit

A database trigger enforces the five-administrator maximum for inserts, role promotions, and reactivation. It obtains a transaction-level advisory lock before counting active administrators, preventing concurrent requests from both creating the fifth and sixth administrators.

The limit applies to active profiles with role `admin`. Deactivating an administrator frees one slot. The application displays the current count, but the database remains authoritative.

### Audit Log

A new append-only `admin_audit_log` table records sensitive administration events:

- account creation
- administrator creation or promotion
- role changes
- password reset initiation
- account activation or deactivation
- initial password replacement

Entries identify the acting profile, target profile, action, timestamp, and non-secret structured details. Passwords, tokens, service keys, and complete credential payloads are never logged.

Clients may not update or delete audit entries. Administrators may read them; trusted server/database code writes them.

## Authentication and Authorization

### Supabase Configuration

Phone authentication is enabled in the hosted Supabase Auth Providers settings. No paid SMS provider is required for phase one because users do not self-register or verify by SMS.

The server provisions users with `auth.admin.createUser` using:

- normalized phone
- generated temporary password
- `phone_confirm: true`
- non-authoritative display-name metadata only

The Supabase service-role key is available only to server code and deployment configuration. It is never prefixed with `NEXT_PUBLIC_`, returned to clients, logged, or committed.

### Login

The login form accepts a Zimbabwean local or E.164 phone number and a password. A shared, tested normalization function converts valid inputs to E.164 before calling `signInWithPassword({ phone, password })`.

Supported examples include `0772829203`, `263772829203`, and `+263772829203`. Invalid lengths, unsupported country codes, alphabetic input, and malformed values are rejected before an authentication request.

The email forgot-password and email recovery flows are removed from the active UI. In phase one, administrators reset a user's password through the protected account-management workflow.

### Forced Password Change

After authentication, middleware/server routing loads the profile. Inactive users are signed out and denied access. Users with `must_change_password = true` are redirected to a dedicated initial-password page and cannot access any role dashboard.

The user submits a new password that meets the configured password policy. The browser updates the authenticated Supabase Auth password, then calls a narrow database function that clears the user's own `must_change_password` flag and writes an audit event. If clearing the flag fails after the Auth password succeeds, the user remains on the forced-change flow and may retry safely with the new password.

### Role Routing

Existing role dashboards remain:

- `admin` -> administrator dashboard
- `discipler` -> discipler dashboard
- `disciple` and `graduate` -> disciple dashboard

Role authorization remains enforced by both server-side page checks and database row-level security. UI visibility alone is never treated as authorization.

## Administrator Account Management

The administrator dashboard replaces email invitations with phone-based account management.

An administrator can:

- create a discipler
- create a disciple later
- create an administrator when fewer than five active administrators exist
- reset a user's password
- activate or deactivate an account
- see role, activation state, and whether the initial password still needs replacement

Creation and reset operations call protected Next.js server routes. Each route:

1. validates the caller's authenticated administrator profile;
2. validates and normalizes input;
3. generates a strong temporary password on the server;
4. performs the Supabase Auth mutation with the service-role client;
5. creates or updates the profile through trusted database access;
6. records an audit event;
7. compensates for partial failure where possible; and
8. returns the temporary password only in the successful response.

The interface presents the credential once with a copy button and a WhatsApp-ready message. Closing the result discards it from application state. Refreshing the page cannot retrieve it. If the password is lost, an administrator must generate a new temporary password.

## Initial 20-User Bootstrap

The two administrators and 18 disciplers are provisioned using a local bootstrap command that reuses the same server-side validation and creation primitives as the admin API.

Production personal data is supplied through a local ignored input file or environment-protected input, not a tracked seed migration. The bootstrap command:

1. validates that exactly two administrator and 18 discipler records are present;
2. normalizes every number to Zimbabwean E.164 format;
3. rejects duplicates before making remote changes;
4. creates each Supabase Auth user and linked profile;
5. marks every account for initial password replacement;
6. records creation audit events; and
7. emits a one-time local credential report for private WhatsApp distribution.

The bootstrap is idempotent by normalized phone number. Re-running it does not silently replace passwords or roles for existing users. It reports existing records and requires a separate explicit reset operation for any correction.

The one-time credential report is excluded by `.gitignore`, is not uploaded to deployment services, and includes a deletion warning. The operator deletes it after credentials have been distributed and securely recorded.

## Database Organization

The existing domain tables remain separated by responsibility:

- `profiles`: identity and role information
- `tracks`: curriculum stages
- `enrollments`: relationships among disciples, disciplers, and tracks
- `sessions`: recorded meetings
- `tasks`: assignments attached to enrollments
- `sms_log`: reserved outbound-message history for the later SMS phase
- `admin_audit_log`: privileged account-management history

The initial generic tracks are treated as placeholders until the church confirms its curriculum. Production disciples are not added until track names, ordering, tasks, and completion rules are approved.

## Error Handling and Recovery

- Every Supabase mutation checks its returned error.
- Server routes return stable status codes without exposing secrets or internal stack traces.
- User creation compensates for a created Auth user when the profile operation fails; unrecoverable inconsistencies are logged for administrator intervention.
- Duplicate phones, the sixth administrator, inactive accounts, and invalid roles produce explicit user-facing errors.
- Loading states always clear in `finally` paths.
- Passwords are never written to logs or audit details.

Because Auth and application tables cannot share a single PostgreSQL transaction, provisioning is designed as a small saga with validation, ordered writes, and compensating cleanup.

## Security and Privacy

- Public signup is disabled.
- Service-role credentials remain server-only.
- Contact input and credential output remain untracked local files.
- Protected role/profile fields are enforced in the database.
- Administrator count is enforced under concurrency in the database.
- Audit records are append-only for clients.
- Password policy is enforced at creation and replacement.
- Rate limiting is added to login and privileged account routes where supported by the deployment environment.
- Phone-number recycling risk is documented; SMS OTP or MFA remains the planned future mitigation.

## Testing

Automated coverage includes:

- Zimbabwean phone normalization and rejection cases
- duplicate phone prevention
- phone/password login payloads
- forced first-login redirects and completion
- inactive-user denial
- server-only service-role use
- account creation authorization
- temporary-password non-persistence
- role validation
- five-admin enforcement, including concurrent attempts
- protected profile fields
- audit-log immutability
- bootstrap validation and idempotency
- existing disciple task restrictions

Verification runs the focused security tests, full test suite, TypeScript, lint, production build, and migration reset against a disposable local Supabase database when the environment supports it.

## Deployment Sequence

1. Merge Security Patch 1.
2. Create and configure the Supabase project.
3. Test all migrations on a disposable local or staging database.
4. Configure phone authentication and disable public signup.
5. Add Supabase public and service-role environment variables to Vercel Preview.
6. Deploy the phone-auth branch to Preview.
7. Apply migrations to the linked Supabase project after a dry run.
8. Exercise administrator, discipler, forced-password, and limit tests in Preview.
9. Bootstrap the initial 20 users and distribute credentials privately.
10. Promote the verified deployment to Production.
11. Repeat a short production smoke test with the two administrators and one discipler before wider credential distribution.

Environment-variable changes require a new deployment. No production credential or personal-data file is stored in GitHub or Vercel source artifacts.

## Future SMS Upgrade

When funding is available, configure a supported SMS or WhatsApp provider and add OTP login. Existing E.164 phone identities, profiles, roles, enrollments, and audit history remain unchanged. Password login can coexist during rollout and be retired only after successful user verification.

## Acceptance Criteria

- Phone-only users can sign in with Zimbabwean numbers and passwords.
- Every newly provisioned user must change the temporary password before dashboard access.
- Either administrator can create another administrator.
- A sixth active administrator is rejected even under concurrent requests.
- The first 20 users can be provisioned without committing their personal data or passwords.
- Administrators can reset passwords and activate/deactivate users.
- Privileged account actions are audited without secrets.
- Role dashboards and existing discipleship workflows continue to operate.
- Migrations reproduce the production schema from a fresh Supabase project.
- Tests, TypeScript, lint, and production build meet the repository's release gate.
