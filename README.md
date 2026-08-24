# The Shepherd's Way

The Shepherd's Way is a church discipleship application for administrators, disciplers, disciples, and graduates. It provides role-specific dashboards, enrollment and curriculum tracking, meeting records, assignments, protected account administration, and forced replacement of temporary passwords.

## Local development

Requirements:

- Node.js 20 or newer
- npm
- a Supabase project

Install and run:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Release checks:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Environment variables

Create `.env.local` with values from the intended Supabase project:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`, expose it to browser code, paste it into an issue, or commit it. Environment files are ignored by Git.

## Database setup

Apply the migrations in this order:

1. `supabase/migrations/20260623_initial_schema.sql`
2. `supabase/migrations/20260820_security_patch_1.sql`
3. `supabase/migrations/20260821_phone_auth_and_account_admin.sql`

The migrations create the discipleship tables, protect profile authorization fields, restrict disciple task updates, add account lifecycle and audit data, enforce the five-active-administrator maximum, and seed three starter tracks.

For a new deployment, verify that the resulting public schema contains `profiles`, `tracks`, `enrollments`, `sessions`, `tasks`, `sms_log`, and `admin_audit_log`. The legacy `invitations` table is removed by the final migration.

## Hosted Supabase Auth settings

For the no-cost first phase, configure **Authentication → Sign In / Providers** as follows:

- Email provider: **enabled**
- Phone provider: **disabled**
- Allow new users to sign up (public signup): **disabled**
- Anonymous sign-ins: **disabled**

Do not enter fake Twilio, MessageBird, Textlocal, or Vonage credentials. Native hosted phone authentication requires a configured SMS provider.

Users still enter only their real Zimbabwean phone number and password. The application normalizes the phone number and produces an Auth-only email identifier:

```text
+263772829203 -> 263772829203@phone.invalid
```

The `.invalid` address is not a contact address and cannot receive email. It is used only as a Supabase password-login username. It must not be shown in dashboards, audit records, administrator responses, WhatsApp messages, or credential reports. The real normalized number is stored in `profiles.phone`; `profiles.email` remains empty for these accounts.

## Initial 20-user bootstrap

The initial production set must contain exactly two administrators and eighteen disciplers. Use an ignored local JSON file based on `scripts/bootstrap-users.example.json`. Do not add passwords to the input file.

Validate the private file without creating accounts:

```powershell
npm run bootstrap:users -- --input "C:\absolute\private\bootstrap-users.production.json" --validate-only
```

Expected result:

```text
Validated 20 users: 2 admins and 18 disciplers.
```

After the application has been deployed with all three environment variables and the target Supabase project has been rechecked, create accounts and a one-time local credential report:

```powershell
npm run bootstrap:users -- --input "C:\absolute\private\bootstrap-users.production.json" --output "C:\absolute\private\initial-user-credentials.csv"
```

The command is idempotent by normalized phone number: it skips existing profiles and never silently replaces their passwords or roles.

The output contains only:

```text
full_name,phone,role,temporary_password
```

Send each person only their own phone number and temporary password through a private channel. Every user is redirected to choose a new password on first login. Delete the credential report after distribution; it cannot be reconstructed from the application. If a credential is lost, an administrator must generate a new temporary password.

Production bootstrap inputs and credential reports are ignored by Git under `/work/bootstrap-users*.json` and `/outputs/*credentials*.csv`. Keep custom private paths outside the repository whenever possible.

## Account administration

Authenticated active administrators can create disciplers and disciples, create administrators while fewer than five are active, reset passwords, and activate or deactivate accounts. Account creation and resets show the temporary password once. Sensitive account actions are written to `admin_audit_log` without storing passwords or service keys.

Public signup stays disabled. A user who needs an account or password reset must contact an administrator.

## Future SMS or WhatsApp upgrade

When funding is available, configure a supported SMS or WhatsApp provider and add native phone identities to the existing Supabase Auth users through trusted migration tooling. Preserve each Auth ID so profiles, roles, enrollments, and audit history remain linked. Keep the no-cost password flow during rollout until every migrated number has been verified successfully.
