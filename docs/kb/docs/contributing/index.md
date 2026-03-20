# Contributing

This section covers the development workflow for working on Tracker Tracker itself — setting up a local environment, running tests, and keeping the codebase clean before submitting changes.

---

## Dev Environment Setup

**Prerequisites:** Node.js >= 22, pnpm, PostgreSQL

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the environment template and fill in your values
cp .env.example .env

# 3. Start a local PostgreSQL instance (Docker is easiest)
docker run -d \
  --name tracker-tracker-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=trackertracker \
  -p 5432:5432 \
  postgres:16-alpine

# 4. Push the Drizzle schema to the database
pnpm db:push

# 5. Start the dev server
pnpm dev
```

The app will be available at `http://localhost:3000`. On first run it redirects to `/setup` to create a master password.

### Key environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | Random secret for JWE session signing |
| `NEXT_PUBLIC_APP_VERSION` | Auto-populated from `package.json` at build time |

---

## Running Tests

The test suite uses [Vitest](https://vitest.dev/).

```bash
# Run all tests once (CI mode)
pnpm test:run

# Run in watch mode during development
pnpm test
```

Test files live in `src/lib/__tests__/` and alongside source files as `*.test.ts`. When adding new adapter logic or utility functions, add a corresponding test file.

---

## Type Checking

```bash
pnpm tsc
```

This runs `tsc --noEmit` against the full project. The codebase must be clean before merging — no `any` escape hatches without a comment explaining why.

---

## Linting

```bash
pnpm lint
```

This runs both steps in sequence:

1. `pnpm tsc` — TypeScript type checking
2. `biome check .` — Biome lint rules (import ordering, unused variables, etc.)

The project uses **Biome** for linting, not ESLint. Do not add ESLint config or ESLint plugins. Biome is also **not** used for formatting — Prettier handles that separately via `pnpm format`.

To check formatting without writing:

```bash
pnpm format:check
```

---

## Database Schema Changes

The project uses **Drizzle's schema-first approach**. All schema changes go in `src/lib/db/schema.ts`. Never write raw SQL migrations.

After editing the schema:

```bash
pnpm db:push
```

This pushes schema changes directly to your local database. For production, the same command applies — there is no separate migration file to commit.

---

## Project Conventions

- **Package manager:** pnpm only. Never use npm or yarn.
- **File header comment:** Every JS/TS file starts with `// path/to/file.ts` (relative to project root).
- **Function index comment:** If a file contains five or more functions, add a comment block at the top listing them all.
- **Imports:** Import only what you need — `import { useEffect } from "react"`, not `React.useEffect`.
- **Error handling:** Never swallow errors silently. Wrap thrown errors with context.

---

## Further Reading

- [Tracker API Responses](tracker-responses.md) — Raw JSON shapes from each tracker platform, used as a reference when adding new trackers or debugging adapter issues.
