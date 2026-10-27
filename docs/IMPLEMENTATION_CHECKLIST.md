# Implementation checklist

Phase A is the application build without a live database. Phase C is the Neon bootstrap and runs only after the instruction `CREATE THE USER`.

## Rules and project

- [x] `CURSOR_RULES.md` written and followed
- [x] Next.js, TypeScript strict, Tailwind, shadcn/ui
- [x] `.env.example` placeholders only
- [x] `.env` ignored by Git

## Database

- [x] Drizzle schema for users, roles, permissions, sessions, login events, audit logs, rate limits, and MFA
- [x] Version-controlled migration `drizzle/0000_warm_iron_monger.sql`
- [x] Append-only trigger on `audit_logs`
- [x] Pooled client for the app and direct client for administrative commands
- [x] Migrations applied to Neon
- [x] Connection verified

## Authentication and authorization

- [x] Argon2id hashing and generic login errors
- [x] Opaque session cookies and database session rows
- [x] PostgreSQL rate limits
- [x] CSRF origin checks on state-changing server actions
- [x] Permission checks on pages, actions, and route handlers
- [x] Last active Super Admin protection
- [x] Optional TOTP MFA with encrypted secrets and recovery codes

## Interface

- [x] Login and MFA challenge pages
- [x] Dashboard section cards and popups
- [x] Users list, search, pagination, detail, create, role change, and suspension
- [x] Company Data administration and offices empty states
- [x] Shipments section for Blue Dart cost and tracking

## Bootstrap

- [x] `npm run db:seed:admin` CLI
- [x] Idempotent identity check that refuses to promote a different account
- [x] Initial Super Admin inserted in Neon

## Verification completed without a database

- [x] `tsc --noEmit` (included in `next build`)
- [x] `vitest run` unit tests
- [x] `eslint .`
- [x] `next build`
- [x] Playwright public flows (authenticated dashboard tests skipped; no administrator exists yet)
- [ ] Integration tests (`ALLOW_DB_TESTS` is not set)

## Waiting

- [x] `.env` configured with the pooled Neon URL
- [x] Super Admin created after the operator asked to continue
- [ ] Hostinger SMTP mailbox user, password, and from address in `.env`
