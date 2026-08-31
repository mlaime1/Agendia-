# AGENTS.md

Express + TS + Prisma backend for AgenDia. Auth via Supabase (anon key on client, service-role on server), data via direct Postgres.

## Commands (no linter/formatter is configured)

```sh
npm run dev            # tsx watch src/server.ts
npx tsc --noEmit       # typecheck (CI gate)
npm run test:unit      # unit tests (CI gate; ~25s)
npm run test           # unit + integration — integration needs local Supabase (see below)
npm run build          # prisma generate && tsc
npm run db:test:setup / db:test:reset
npm run db:migrate:dev / db:migrate:deploy
npm run db:seed        # tsx prisma/seed.ts
```

Verify code with `npx tsc --noEmit` then `npm run test:unit`. Run a single test:
`npx jest --testPathPatterns=unit tests/unit/modules/users/service.test.ts`

## Critical architecture facts

- **Data access = Prisma only** (`src/config/prisma.ts`, `@prisma/adapter-pg` → direct Postgres via `DATABASE_URL`). The Supabase client (`src/lib/supabase.ts`, **service-role** key) is used **only for Auth** (login, `getUser`, admin user management). There is **no `supabase.from()`**. Hence RLS does **not** affect the backend — you can enable RLS on tables freely.
- **BigInt IDs**: all PKs are `BigInt`. `src/utils/bigint.ts` patches `BigInt.prototype.toJSON` (must stay imported — `app.ts` imports it). Prisma returns `bigint`; IDs are serialized as strings. Always convert with `BigInt(id)` where inputs are strings.
- **Auth → request user**: `verifyToken` (`src/middlewares/verifyToken.ts`) → `supabase.auth.getUser(token)` → looks up `users` or `clients` by `auth_id` → sets `req.user = { authId, role, dbId, phone }`. Roles: `DRIVER | ADMIN | PASSENGER` (Prisma enum) plus synthetic `'client'`.
- **The user's `phone` lives in Supabase Auth** (`auth.users.phone`), not in any Prisma table. `updateMe` calls `supabase.auth.admin.updateUserById(uid, { phone, phone_confirm: true })`; `getMe` reads it from `req.user`. `clients.phone` is a separate business/WhatsApp contact (`Decimal` — do not put `+…` strings there) and is driver/admin-owned.

## Module conventions

Each module in `src/modules/<name>/` = `controller.ts` (req/res only) + `service.ts` (business logic) + `routes.ts` + `types.ts`. Central router: `src/routes/index.ts`. Imports are **relative** (`../../lib/...`); the `@/` alias exists only in the Jest `moduleNameMapper`, not in tsconfig/build.

## Env & DB gotchas

- `src/config/prisma.ts` loads `.env.test` when `NODE_ENV=test`, else `.env`. `jest.config.ts` loads `.env.test` first.
- Tests hard-fail unless `DATABASE_URL` points to a DB whose name contains `_test`/`test` (safety guard in `tests/helpers/testDb.ts:24`). Use `.env.test` (copy from `.env.test.example`).
- **Integration tests require a running local Supabase** (`supabase start`, Docker) and the test Supabase Auth instance. They are **disabled/removed from CI** (see `.github/workflows/ci.yml`). `npm test` runs them and will fail without the stack; default to `npm run test:unit` for verification.
- Prisma migrations: `prisma.config.ts` datasource uses `DATABASE_URL`, but schema changes may need the direct (non-pooler) URL — see the swap-to-`DIRECT_URL` note in that file.
- Schema models carrying the "row level security" comment on some tables (`clients`, `users`, etc.) — irrelevant for the backend since it bypasses RLS.

## Repo layout

- `src/{config,modules,middlewares,utils,routes,docs,lib}` — app code; entry `src/server.ts`, Express wiring `src/app.ts`.
- `tests/{unit,integration,helpers}` — unit tests are self-contained; integration uses `helpers/testDb.ts`/`factories.ts` + `setup-integration.ts`.
- `prisma/` — `schema.prisma`, `migrations/`, `seed.ts`. `docs/` — module plans/summaries.
- `supabase/` — local stack config + initial remote schema migration.
