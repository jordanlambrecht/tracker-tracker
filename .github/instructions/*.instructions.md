# Copilot PR Review Instructions

## Project

Self-hosted single-user dashboard for monitoring private tracker stats. Next.js 16 App Router, PostgreSQL, Drizzle ORM, Tailwind v4, Vitest.

## Package Manager

pnpm only. Never use npm or yarn. Node.js >= 22 required.

## File Conventions

- First line of every JS/TS file: `// relative/path/to/file.tsx`
- If a file has 5+ functions, add a comment block listing them after the filepath comment
- Client components need explicit `"use client"` directive
- Server-only modules use `import "server-only"` at the top

## Imports

- Do not import the entire React package. Destructure: `import { useState, useEffect } from "react"` not `import React from "react"`
- Use `import type { ... }` for type-only imports.
- Path aliases: `@/` maps to `src/`, `@typography` maps to Typography components.
- Import order is enforced by Biome's `organizeImports` rule. Components before lib before types.

## Database (Drizzle ORM)

- ALWAYS use Drizzle's schema-first approach. NEVER use raw SQL migrations.
- Schema lives in `src/lib/db/schema.ts`. Use `drizzle-kit push` to sync schema to DB.
- `DISTINCT ON` is supported natively via `db.selectDistinctOn()`. Do not use `db.execute(sql\`...\`)` for this.
- Use explicit column projections in `.select({ ... })` instead of `.select()` (which fetches all columns).
- BigInt columns use `{ mode: "bigint" }` and return native `bigint` values from queries.
- Upserts use `.onConflictDoUpdate()` or `.onConflictDoNothing()`.

## BigInt Handling

- Tracker upload/download/buffer values are stored as `bigint` in the database.
- Always wrap BigInt conversions in try/catch when processing external data.
- `Number.MAX_SAFE_INTEGER` is ~9 PiB. Daily deltas will never approach this. Do not over-engineer BigInt→Number conversions for percentage calculations on daily deltas.
- Serialize bigints as `.toString()` in API responses (JSON cannot represent BigInt).

## Timezone

- All date strings for checkpoint tables and daily comparisons use `localDateStr()` from `src/lib/formatters.ts`, which respects the `TZ` environment variable.
- Do NOT use `.toISOString().slice(0, 10)` for checkpoint dates — that returns UTC, not the user's configured timezone.
- When `TZ` is not set, `localDateStr()` falls back to UTC (same behavior as `toISOString`).

## Error Handling

- All catch blocks must either log the error (`log.warn`, `log.error` from `@/lib/logger`) or re-throw. Empty catch blocks trigger the security audit.
- Use `log` from `@/lib/logger` (pino), not `console.log` / `console.error`.
- Decryption errors (stale session keys) should return HTTP 401, not 422 or 500. Use `isDecryptionError()` from `@/lib/error-utils`.
- Scheduler and poll operations wrap checkpoint writes in try/catch so failures don't break the poll cycle.

## API Routes

- Every route handler must call `authenticate()` from `@/lib/api-helpers` and check the result before proceeding.
- Use `NextResponse.json()` for responses.
- Sensitive data (encrypted tokens, password hashes, encryption salts) must never appear in API responses. Column projections exclude them structurally.

## Authentication

Single-user app with master password auth. No third-party providers.

- **Three-layer defense in depth:** `proxy.ts` (cookie presence check) → `getSession()` (JWE decrypt) → route handler (`authenticate()` + `decodeKey()`)
- **Session:** JWE (encrypted JWT via `EncryptJWT`, not `SignJWT`), stored in `tt_session` httpOnly/secure/sameSite=strict cookie. Contains `{ ek: encryptionKeyHex }`.
- **Key derivation:** master password → `scrypt(password, salt, 32)` → AES-256-GCM key. This key decrypts all API tokens in the DB.
- **JWE key:** derived from `SESSION_SECRET` env via HKDF-SHA256 with domain-separated info labels.
- **Sliding session refresh:** `proxy.ts` re-sets cookie expiry on every request without decrypting the JWE.
- **Lockout:** atomic SQL counter (`failedLoginAttempts + 1`), configurable threshold, returns 429 with Retry-After. Both login and TOTP verify paths increment.
- **TOTP 2FA:** optional, uses `otpauth` library. Backup codes are hex `XXXX-XXXX`, compared with `timingSafeEqual`.
- **Stale sessions:** when the encryption key doesn't match (i.e., password changed), AES-GCM auth tag fails. `isDecryptionError()` catches this → return 401, not 422/500.
- **Key zeroing:** `stopScheduler()` zero-fills the key buffer on logout.
- **Public routes:** defined in `proxy.ts` as `PUBLIC_EXACT` and `PUBLIC_PREFIX` arrays. All other routes require the cookie.

Route handler pattern:

```ts
const auth = await authenticate()
if (auth instanceof NextResponse) return auth // 401
const key = decodeKey(auth) // Buffer
// use key to decrypt DB fields
```

## Security (CI Audit)

- A static security audit runs in CI (`scripts/security-audit.ts`). It checks for: missing auth on routes, hardcoded secrets, bare catch blocks, console.log in routes, raw SQL in routes, unvalidated JSON parse, unsafe redirects, missing fetch timeouts, and more.
- Suppress findings with `// security-audit-ignore: <reason>` on the line above. A bare suppression without a reason is itself a critical failure.
- URL inputs are validated against SSRF via `isUnsafeNetworkHost()` in `src/lib/network.ts`.

## Component Patterns

- Component anatomy: internal sub-components are unexported functions within the file. Single public export at the bottom. Types exported with `export type { ... }`.
- Use React 19's ref-as-prop pattern (direct `ref` prop), not `forwardRef`.
- SVG path calculations with floating-point geometry should round to 2 decimal places for SSR hydration safety.

## HMR Safety

All module-level singletons (cron tasks, DB client, qBT SID cache) must be stored on `globalThis` to survive webpack HMR reloads in development. Without this, hot-reloads orphan the old instance while creating a new one.

## Testing

- Framework: Vitest.
- Test mocks must match real API response shapes. Do not add fields (i.e., `isPrivate: true`) that the real API does not return — this masks bugs.
- Do not add test-only methods to production classes. Put test utilities in test files.

## Code Organization

- Page files (`page.tsx`) should be thin wrappers — mostly orchestration and render logic. Extract business logic, UI sections, and data fetching into components and hooks.
- Repeated code should be extracted to helper functions or reusable components. Do not duplicate logic across files.
- Centralized constants belong in `src/lib/constants.ts`. Avoid magic strings and magic numbers scattered throughout the codebase.

## SSR / Hydration

- NEVER read `localStorage` in `useState` initializers — causes hydration mismatch. Initialize with a server-safe default, then hydrate in `useEffect`.

## Adapter Pattern

- Tracker platforms use an adapter pattern: `TrackerAdapter` interface with `getAdapter()` factory. UNIT3D, Gazelle, and GGn are implemented. Adding a new platform means adding a new adapter file in `src/lib/adapters/`, not modifying existing ones.

## Precision Concerns

- Daily upload/download deltas are computed as BigInt subtraction. Converting daily deltas to Number for percentage calculations is safe — `Number.MAX_SAFE_INTEGER` (~9 PiB) vastly exceeds any realistic daily transfer. Do not over-engineer BigInt arithmetic for percentage computations on daily deltas.

## External HTTP Requests

- All `fetch()` calls must include a timeout: `fetch(url, { signal: AbortSignal.timeout(15_000) })`. This is a CI-blocking security audit check.
- URLs from user input must be validated with `validateHttpUrl()` before use in `fetch()`.
- Error messages must not contain full URLs (which may include API tokens). Use `sanitizeNetworkError()`.

## Validation

- Use centralized helpers from `src/lib/api-helpers.ts`: `authenticate()`, `parseJsonBody()`, `parseRouteId()`, `validateHttpUrl()`, `validateHexColor()`, `validatePort()`, `validateJoinedAt()`.
- All validators return `NextResponse | null` — check with `if (err) return err`.
- String inputs: check type, trim, enforce length limits (i.e., name <= 100 chars, URL <= 500 chars).

## Encryption

- AES-256-GCM with random 12-byte IV. Format: `base64(iv + authTag + ciphertext)`.
- Key derivation: `scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 })`.
- Use `encrypt()`/`decrypt()` from `src/lib/crypto.ts`. Keys are always `Buffer`.
- Encryption keys are zeroed in memory on logout via `stopScheduler()`.

## Accessibility

- `useId()` for stable label/input ID association in form controls.
- `aria-invalid` and `aria-describedby` on inputs with errors.
- `aria-hidden="true"` on decorative icons/SVGs.
- `aria-label` on icon-only buttons.

## Things NOT to Do

- Do not use ESLint. It has been deprecated for this project.
- Do not use `npm` or `yarn` — `pnpm` only.
- Do not create raw SQL migration files. Use `drizzle-kit push`.
- Do not use `.toISOString().slice(0, 10)` for checkpoint/daily dates — use `localDateStr()`.
- Do not pass unknown props through to DOM elements via `{...rest}` spreads without filtering component-only props first.
- Do not use dynamic code execution or inject raw HTML into the DOM. See `scripts/security-audit.ts` for the full list of banned functions.
- Do not use `===` for secret comparisons — use `timingSafeEqual`.
- Do not use `Number()` or `parseInt()` directly on BigInt database columns.
- Do not commit `.env` files.
- Do not use `JSON.parse()` without a try/catch wrapper.
- Do not use `console.log` in API routes — use the `log` instance from `@/lib/logger`.
- Do not use `db.execute()` in API routes (raw SQL is banned except for the health check `SELECT 1`).
