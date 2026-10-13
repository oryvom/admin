# ORYVOM MOBILITY PRIVATE LIMITED — Admin Portal

Administrative web application for **ORYVOM MOBILITY PRIVATE LIMITED**.

This application uses Neon PostgreSQL through Drizzle ORM. It does not fall back to an in-memory database, local JSON, or client-side authentication.

## Technology

- Next.js App Router and React
- TypeScript (strict)
- Tailwind CSS and shadcn/ui
- Neon PostgreSQL with Drizzle ORM and Drizzle Kit
- Zod and React Hook Form
- Email one-time codes for sign-in, delivered through Hostinger SMTP
- Argon2id hashing for unused internal secrets (`@node-rs/argon2`)
- Opaque database-backed sessions
- TOTP multi-factor authentication (optional until a user enrolls)
- Vitest and Playwright

## Architecture

Server Components render protected pages. Client Components are limited to forms, dialogs, and navigation that need browser interaction.

Authentication and authorization run on the server. `src/proxy.ts` only redirects anonymous visitors who have no session cookie. Layouts, server actions, and route handlers load the session from PostgreSQL and check permissions there.

Business rules live in `src/server/policies` and `src/server/services`. Database access lives in `src/server/repositories`. Pages do not query the database directly.

## Directory structure

```text
src/app/                  routes, layouts, and route handlers
src/components/ui/        shadcn/ui primitives
src/components/layout/    authenticated shell
src/components/dashboard/ section cards and popups
src/components/forms/     login, MFA, and user actions
src/features/             validation and server actions
src/lib/                  config, security helpers, Drizzle schema
src/server/               policies, repositories, and services
drizzle/                  version-controlled SQL migrations
scripts/                  database check, bootstrap, and retention
tests/unit/               tests that do not need a database
tests/integration/        database tests, skipped unless explicitly enabled
tests/e2e/                browser tests
```

## Prerequisites

- Node.js 24 or newer
- npm
- A Neon project when you are ready to connect a database

Phase A of setup does not require a database URL. Migrations are generated and stored in the repository. They are not applied until you configure `.env` and explicitly ask for the initial administrator to be created.

## Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` locally. Do not commit it. Do not put secrets in source files or in `NEXT_PUBLIC_` variables.

Generate fresh secrets:

```bash
openssl rand -base64 48   # SESSION_HASH_SECRET
openssl rand -base64 32   # FIELD_ENCRYPTION_KEY
```

Start the application only after the database is migrated and the initial administrator exists:

```bash
npm run dev
```

The login page is `/login`. A successful sign-in opens `/dashboard`.

## Neon connection strings

Create a Neon project and copy both connection strings from the Neon dashboard. Do not paste them into chat, source code, or `.env.example`.

| Variable | Neon dashboard value | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Pooled connection | Application queries, migrations, and bootstrap |

Use the development or initial-setup database while bootstrapping. The bootstrap command does not create a database.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Neon URL |
| `SESSION_HASH_SECRET` | Yes | HMAC key for session tokens, login codes, MFA, and rate-limit identifiers |
| `SMTP_HOST` | Yes, to send codes | Hostinger SMTP host, normally `smtp.hostinger.com` |
| `SMTP_PORT` | Yes, to send codes | `465` |
| `SMTP_USER` | Yes, to send codes | Full mailbox address |
| `SMTP_PASSWORD` | Yes, to send codes | Mailbox password |
| `SMTP_FROM` | Yes, to send codes | From address, for example `ORYVOM <mailbox@your-domain.com>` |
| `FIELD_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte AES-256-GCM key for TOTP secrets |
| `APP_ORIGIN` | No | Public origin for CSRF checks behind a proxy, such as `https://admin.example.com` |
| `ENABLE_HSTS` | No | Set to `true` only after HTTPS is working on the deployment domain |

Development and production use the same variable names. Production must set `NODE_ENV=production` through the host, use HTTPS, and keep `ENABLE_HSTS` unset until the certificate is confirmed. Local `next start` on HTTP must leave `ENABLE_HSTS` unset so the browser is not forced onto HTTPS.

The process fails closed when a required variable is missing or invalid. Error messages list variable names, not values.

## Database commands

```bash
npm run db:generate   # create a migration from the Drizzle schema
npm run db:migrate    # apply pending migrations with the direct connection
npm run db:check      # confirm the database answers and migrations are present
npm run db:seed:admin # create the initial Super Admin
npm run db:studio     # open Drizzle Studio
npm run db:prune-login-events -- --confirm
```

Migrations do not run during application startup. Do not use `drizzle-kit push` against a database that already holds data.

The initial migration creates roles, permissions, users, sessions, login events, audit logs, rate limits, and MFA tables. `audit_logs` has a trigger that rejects `UPDATE` and `DELETE`. A database superuser can disable that trigger; application code has no update or delete path for audit rows.

Login events older than 180 days can be removed with `npm run db:prune-login-events -- --confirm`. The script refuses to run without `--confirm`. Audit logs are not pruned.

## Initial Super Admin

The bootstrap identity is fixed in `src/server/policies/bootstrap.ts`:

- Name: Manjeet Chandra
- Email: majormchandra@gmail.com
- Phone: 8252945156
- Role: SUPER_ADMIN
- Status: ACTIVE

The user id is generated by PostgreSQL during insert. Do not invent one in advance.

There is no public setup page. The only bootstrap entry point is:

```bash
npm run db:migrate
npm run db:seed:admin
```

Run those commands only after `.env` points at the intended development database and you have explicitly decided to create the account.

Sign-in uses a 6-digit code sent to the account email through Hostinger SMTP. The person can enter either the account email or the account phone number. The code expires in 10 minutes, is stored only as a hash, and is not printed in logs.

The bootstrap command prints the user id, email, role, and status. It does not print session tokens or connection strings. An internal Argon2id hash is stored because the users table requires one. That value is random, unused for sign-in, and is not printed.

Running bootstrap again is safe when the existing row already matches that identity, role, and status. If the email exists with a different name, phone, role, or status, the command stops and does not change the account.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm test` runs unit tests and loads the integration file. Integration tests stay skipped unless all of the following are true:

- `ALLOW_DB_TESTS=true`
- `TEST_DATABASE_URL` is a PostgreSQL URL whose database name contains `test` and does not contain `prod`

Those tests migrate and truncate application tables on that database. Do not point them at a production database.

Authenticated Playwright tests stay skipped unless `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are set. `npm run test:e2e` expects a production build and starts `next start` on port 3000. Install a browser once with:

```bash
npx playwright install chromium
```

## Production build and deployment

```bash
npm run build
npm start
```

Deploy the Node.js server over HTTPS. Set the environment variables in the host's secret store. Apply migrations as a separate release step with `npm run db:migrate` before starting the new version. Do not run the bootstrap command on every deploy.

Back up the Neon project on the schedule Neon provides for your plan, and confirm you can restore to a new branch before relying on it. The application does not implement its own backup job.

Session cookies are named `oryvom_session`. They are HTTP-only, `SameSite=Lax`, and `Secure` when `NODE_ENV` is production. The absolute lifetime is 12 hours and the idle lifetime is 30 minutes. Logout revokes the server session. Password changes and account suspension revoke the account's sessions.

Login rate limits are stored in PostgreSQL so they apply across application instances.

## Company administration documents

`/company-data/administration` stores the company name, CIN, PAN, TAN, and registered address. The state control lists every Indian state and union territory. The database stores the ISO 3166-2 code only.

Statutory files are sent by this server to `https://intfiles.oryvom.com`. The browser never talks to that host directly. Neon stores the checksum and a random storage id, not the file.

Set `FILE_STORAGE_BASE_URL` and `FILE_STORAGE_SECRET` in `.env`. Copy `hostinger/intfiles` onto the Hostinger account using `hostinger/intfiles/PLACEMENT.txt`. The PHP secret must match `FILE_STORAGE_SECRET`. Keep `private/config.php`, the storage directory, and `private/logs/host.log` outside `public_html`. The administration page can open that log after a failed upload. Re-upload `bootstrap.php`, `log.php`, and `public_html/.htaccess` when those files change.

## Adding a dashboard section

Add an entry to `src/features/dashboard/sections.ts` with a permission and links. Add the matching navigation item in `src/features/navigation/items.ts`. Filter with the existing permission helper. Create a protected page under `src/app/(protected)/`.

## Adding a role or permission

Add the permission key to `PERMISSIONS` in `src/server/policies/permissions.ts`, then assign it in `ROLE_DEFINITIONS`. `ensureRoleCatalog` inserts missing keys idempotently the next time an administrator is provisioned or a user is created. Existing sessions keep the permissions loaded at request time from the database, so a new assignment is visible on the next request after the catalog write.

Do not grant `users.grant_super_admin` to a role that should not create Super Admins. Users cannot change their own role. The last active Super Admin cannot be demoted or suspended.

## Adding a table and migration

1. Edit `src/lib/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review the SQL in `drizzle/`.
4. Run `npm run db:migrate` against the intended database.

Keep hand-written statements, such as the audit-log trigger, in the migration file. Regenerating a new migration diffs the schema snapshot and does not delete earlier SQL.

## Known limitations

- Sign-in is a one-time code emailed through SMTP. Password reset is not a separate flow.
- MFA enrollment, verification, recovery codes, and encrypted TOTP secrets are implemented. Enrollment is optional. A Super Admin can sign in before enrolling. The dashboard links to Security until MFA is enabled.
- The audit trigger depends on the database role being unable to disable triggers. A Neon owner can.
- Content Security Policy allows inline styles because Radix UI sets them. Scripts use a per-request nonce and `strict-dynamic`.
- `npm audit` may report vulnerabilities inherited from the framework toolchain. Review them before running a forced upgrade.
- Company administration and offices have no tables and no records yet. Both pages are protected empty states.
- This document does not claim the application is free of security defects. Review authentication, authorization, and dependency updates before production use.

## Outstanding security work

- Require MFA before Super Admin actions once enrollment has been verified in the target environment.
- Add a password-reset flow with single-use hashed tokens, expiry, and login-event records.
- Confirm the Content Security Policy against the deployed domain after the first production release.
- Turn on HSTS only after HTTPS responds correctly on that domain.
