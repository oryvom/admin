# ORYVOM Admin Portal — Cursor Rulebook

This file governs all implementation work in this repository. Read it before adding or changing application code.

Company: ORYVOM MOBILITY PRIVATE LIMITED
The interface uses the company name only.
Database: Neon PostgreSQL only

## Code quality

- Use TypeScript strict mode.
- Avoid `any`, `@ts-ignore`, unexplained type assertions, and unnecessary ESLint suppressions.
- Use Server Components by default.
- Use Client Components only when browser interaction requires them.
- Keep business logic out of presentation components.
- Use clear module boundaries between UI, services, policies, and repositories.
- Avoid duplicated authentication, authorization, validation, and database logic.
- Use shared utilities and components where appropriate.
- Avoid overengineering and excessive abstraction.
- Avoid unnecessary dependencies.
- Use typed Drizzle queries. Do not concatenate SQL from user input.
- Use Zod for input validation.
- Use consistent naming: `camelCase` in TypeScript, `snake_case` in PostgreSQL.
- Handle loading, error, empty, and success states.
- Do not leave unfinished security-critical placeholders.
- Do not claim functionality exists unless it is implemented.
- Do not claim a command, test, or database operation succeeded unless it was actually executed.

## Component standards

- Prefer shadcn/ui components whenever suitable components are available.
- Create custom components under `src/components/` when necessary.
- Keep reusable components independent of page-specific business rules.
- Use consistent spacing, typography, colors, responsive behavior, and accessibility.
- Never duplicate a component because another page needs similar behavior.
- Dashboard sections share one configuration-driven card and dialog.

## Security standards

- Authentication is enforced on the server.
- Authorization is enforced on the server for pages, route handlers, server actions, and mutations.
- Proxy may redirect anonymous visitors. It is not the only security layer.
- Never trust a client-supplied role, permission, or user id.
- Never expose passwords, hashes, session tokens, MFA secrets, recovery codes, or private configuration.
- Never store authentication authority in `localStorage` or `sessionStorage`.
- Never put database credentials in client bundles. Never prefix secrets with `NEXT_PUBLIC_`.
- Never hardcode a production password or commit `.env`.
- Never expose an unauthenticated Super Admin creation endpoint.
- Never allow a user to grant themselves administrative privileges.
- A user cannot change their own role.
- Never silently promote an existing account to Super Admin.
- Never remove or suspend the last active Super Admin without a replacement.
- Never disable security controls to make a test pass.
- Use version-controlled Drizzle migrations. Do not drop and recreate tables as a shortcut.
- Do not run migrations automatically on application startup.
- Do not run migrations or seed data until the operator has configured the environment and explicitly approved the operation.
- Audit sensitive administrative actions in an append-only audit log.
- Do not log passwords, cookies, session tokens, reset tokens, MFA secrets, or connection strings.
- Keep authenticated responses out of shared caches (`Cache-Control: private, no-store`).
- Fail safely when required configuration is missing. Never fall back to mock users, an in-memory database, or static JSON.
- If login-event persistence fails, do not issue a session.
- Use generic login errors that do not reveal whether an email exists.
- Validate redirect targets. Reject protocol-relative and absolute URLs.
- Use Argon2id for passwords and store only a hash of each opaque session token.
- Use HTTP-only session cookies. Set `Secure` in production. `SameSite=Lax`. `Path=/`.
- Rate-limit login attempts in PostgreSQL so limits hold across instances.
- Encrypt TOTP secrets at rest. Store only hashes of recovery codes.

## Development workflow

For each major feature:

1. Read the relevant project rules.
2. Inspect existing code.
3. Reuse existing modules where appropriate.
4. Implement the feature.
5. Run applicable tests.
6. Fix failures.
7. Update the implementation checklist and documentation.

Do not delete existing working functionality without justification.
Do not run destructive operations against production databases.
Do not print secret environment variable values.

## Database workflow

- `DATABASE_URL` is the Neon pooled connection used by the application, migrations, and the bootstrap CLI.
- Application queries stay on the server.
- Reuse the database client within the Node.js process. Do not open a new pool per query.
- Interactive transactions run through the Neon serverless WebSocket driver.
- Schema changes go through `npm run db:generate` and committed SQL in `drizzle/`.
- `npm run db:migrate` and `npm run db:seed:admin` are explicit operator commands.

## Module map

- `src/app` — routes, layouts, and route handlers.
- `src/components` — reusable UI.
- `src/features` — feature schemas, actions, and view models.
- `src/lib` — config, database schema, and shared security helpers.
- `src/server/repositories` — typed database access.
- `src/server/services` — business operations.
- `src/server/policies` — authorization decisions.
- `scripts` — CLI commands that are not HTTP endpoints.
- `tests` — Vitest and Playwright tests.
