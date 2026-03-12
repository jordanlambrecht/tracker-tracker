<!-- SECURITY.md -->

# Security Architecture

This document describes the security controls, threat model, and testing methodology for Tracker Tracker.

Last audited: `2026-03-12`

## Authentication

- **Password hashing**: Argon2 (memory-hard KDF) via `argon2` library — see `src/lib/auth.ts`
- **Session tokens**: Encrypted JWE (A256GCM) via `jose` library — see `src/lib/auth.ts`
- **Cookie security**: httpOnly, secure (in production), sameSite=strict, 7-day hard expiry
- **Password policy**: 8-128 character requirement enforced on setup and login
- **Username**: Optional login username (6-100 chars), case-insensitive comparison
- **TOTP 2FA**: Optional TOTP via `otpauth` library (SHA1, 6 digits, 30s period, ±1 window). Secret encrypted at rest with AES-256-GCM. Stateless enrollment via JWE setup tokens (5min TTL).
- **Backup codes**: 8 codes in XXXX-XXXX hex format, hashed with SHA-256 + random salt, encrypted at rest. Each code single-use.
- **Two-step login**: When TOTP is enabled, login returns a pending token (60s JWE) instead of a session. Client sends pending token + TOTP code to complete authentication.
- **Auth model**: No whitelist or bypass — every API route independently calls `authenticate()` which decrypts the JWE session

## Data Classification

| Data | Storage | Encrypted | Justification |
| --- | --- | --- | --- |
| Master password | `app_settings.password_hash` | Argon2 hash (irreversible) | Memory-hard KDF; cannot be reversed |
| Tracker API tokens | `trackers.encrypted_api_token` | AES-256-GCM | Most sensitive field; provides account access |
| Encryption key | JWE session cookie + scheduler memory | JWE (A256GCM) | Never written to disk in plaintext; zero-filled on logout |
| Encryption salt | `app_settings.encryption_salt` | No | Salt is not secret; useless without master password |
| Tracker names | `trackers.name` | No | User-assigned label; not inherently identifying |
| Tracker base URLs | `trackers.base_url` | No | Reveals which trackers the user monitors |
| Tracker usernames | `tracker_snapshots.username` | No | Fetched fresh from tracker API on each poll |
| User class/group | `tracker_snapshots.group_name` | No | Fetched fresh from tracker API on each poll |
| Upload/download stats | `tracker_snapshots.*_bytes` | No | Numeric time-series; meaningful only with context |
| Ratio, seedbonus, H&Rs | `tracker_snapshots.*` | No | Numeric time-series; meaningful only with context |
| Session cookie | Browser (`tt_session`) | JWE (A256GCM) | httpOnly, secure, sameSite=strict |
| TOTP secret | `app_settings.totp_secret` | AES-256-GCM | TOTP enrollment secret; compromised = account takeover |
| Proxy password | `app_settings.encrypted_proxy_password` | AES-256-GCM | Proxy service credential |
| qBT credentials | `download_clients.encrypted_*` | AES-256-GCM | Download client authentication |
| Backup files | Filesystem (optional) | AES-256-GCM (optional) | Contains all data including encrypted fields as ciphertext |

**Disk seizure note:** If an adversary gains access to the raw database files, all unencrypted fields above are readable. To protect against this scenario, deploy on an encrypted filesystem (LUKS, dm-crypt, or equivalent). See [Known Limitations](#known-limitations).

## Encryption at Rest

All tracker API tokens are encrypted before database storage — see `src/lib/crypto.ts`.

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key derivation | scrypt (N=16384, r=8, p=1) |
| IV | 12 bytes random per encryption |
| Auth tag | 16 bytes |
| Salt | 32 bytes random, stored in `app_settings.encryption_salt` |

The encryption key is derived from the master password on login and stored in the encrypted JWE session. It is never persisted to disk in plaintext.

## Route Protection (Defense in Depth)

Authentication is enforced at three independent levels:

1. **Proxy** (`src/proxy.ts`): Checks for `tt_session` cookie existence on all non-public routes. Returns 401 for API routes, redirects to /login for pages.
2. **Route handlers**: Each API route calls `authenticate()` from `src/lib/api-helpers.ts`, which decrypts and validates the full JWE token.
3. **Layout guard** (`src/app/(auth)/layout.tsx`): Server Component calls `getSession()` to decrypt JWE before rendering any authenticated page.

Public routes are explicitly limited to: `/login`, `/setup`, `/api/auth/*`, `/api/health`.

## Data Protection

- `encryptedApiToken` is **never** included in API responses — explicit field exclusion with `// SECURITY` comment in `src/app/api/trackers/route.ts:28`
- All database queries use Drizzle ORM (parameterized queries, no SQL injection surface)
- No unsafe HTML injection methods anywhere in the codebase
- **Emergency lockdown** (`POST /api/settings/lockdown`): Stops scheduler, revokes all API tokens, rotates encryption salt (orphans ciphertext), wipes TOTP/username, destroys session. Requires active session. UI requires three-checkbox acknowledgment before sending the request.
- **Scrub & delete** (`POST /api/settings/nuke`): Overwrites sensitive columns with random bytes, deletes all rows, runs `VACUUM FULL` to rewrite table files. Requires active session + master password. Resists forensic recovery from Postgres data files.
- **Backup/restore**: Backup files are pure JSON (no zip/tar archives). Restore validates all fields before database writes. File deletion uses path traversal defense (`path.resolve()` + base directory prefix check). Restore requires master password re-confirmation (separate from login auth). Encrypted fields travel as ciphertext — never decrypted during backup. See [Backup Security](#backup-security).
- External HTTP requests use 15-second `AbortSignal.timeout()` — see `src/lib/adapters/unit3d.ts:29`
- Error messages sanitize hostnames (do not leak full URLs containing API tokens)

## Input Validation

All API routes validate inputs — see `src/app/api/trackers/route.ts` and `src/app/api/trackers/[id]/route.ts`.

| Field | Constraint |
|---|---|
| Tracker name | string, max 100 chars, trimmed |
| Base URL | string, max 500 chars, validated via `new URL()`, scheme restricted to `https://` or `http://` |
| API token | string, max 500 chars |
| Color | hex color format only (`#[0-9a-fA-F]{3,8}`), rejects arbitrary strings |
| qBittorrent tag | string, max 100 chars, trimmed |
| Poll interval | integer, clamped to 15-1440 minutes |
| Tracker ID | parsed as integer, NaN rejected |
| Platform type | allowlist: `["unit3d", "gazelle", "ggn", "nebulance"]` |
| Password | string, 8-128 chars |
| Role name | string, max 255 chars |
| joinedAt | regex-validated YYYY-MM-DD or null |
| Notes (roles) | string, max 2000 chars |

## Security Response Headers

Configured in `next.config.ts` for all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (disables legacy XSS auditor; modern browsers ignore it, but setting to 0 prevents IE/Edge quirks)
- `X-DNS-Prefetch-Control: off` (prevents DNS prefetching which can leak browsing activity)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Threat Model

| Property | Description |
|---|---|
| User model | Single user, self-hosted |
| Deployment | Docker Compose (open-source) |
| Trust boundary | Network perimeter; may be internet-facing behind reverse proxy |
| Primary threats | Unauthorized access, credential leakage, supply chain |
| External calls | User-configured tracker URLs (UNIT3D, Gazelle, GGn, Nebulance APIs) + qBittorrent clients |
| Data sensitivity | Tracker API tokens (encrypted), usage statistics |

## Huntarr Anti-Pattern Checklist

Comparison against the 21 vulnerabilities found in Huntarr v9.4.2 ([security review](https://github.com/rfsbraz/huntarr-security-review)):

| Huntarr Vulnerability | Status | Implementation |
|---|---|---|
| Unauthenticated settings write | Mitigated | All routes call `authenticate()` |
| Setup flow re-arm without auth | Mitigated | Setup checks for existing config, no clear/reset endpoint |
| TOTP enrollment without auth | Mitigated | TOTP setup/confirm/disable all require active session via `authenticate()` |
| Recovery key without auth | Mitigated | Backup codes shown only during enrollment; disable requires valid code |
| Zip Slip file write | Mitigated | Backups are pure JSON, not archives; no file extraction |
| Path traversal in backup | Mitigated | File deletion validates resolved path against configured base directory + `path.sep` |
| Auth bypass whitelist | Mitigated | No whitelist — direct auth per route |
| Passwords in API responses | Mitigated | `encryptedApiToken` explicitly excluded from all responses |
| SHA-256 password hashing | Mitigated | Argon2 memory-hard KDF |
| Cleartext credential storage | Mitigated | AES-256-GCM encrypted at rest |
| X-Forwarded-For trust | N/A | No proxy bypass mode |
| Hardcoded API keys | Mitigated | All secrets from env vars or encrypted user input |
| XML parsing vulnerabilities | N/A | No XML handling |
| Container runs as root | Mitigated | Dockerfile uses `USER nextjs` (UID 1001) with explicit `adduser`/`addgroup` |
| Broad auth bypass matching | Mitigated | Explicit route-level auth, no substring/suffix matching |
| Full cross-app credential exposure | Mitigated | Responses return only safe fields, not entire config |
| World-writable file permissions | N/A | No installation scripts or service files |
| Network calls without timeouts | Mitigated | 15-second AbortSignal on all external fetches |
| Weak password hashing (salted SHA-256) | Mitigated | Argon2 with default parameters |
| No dependency scanning | Mitigated | Automated via `dependency-review.yml` GitHub Actions workflow on every PR |
| No security disclosure process | Mitigated | This document, plus issue tracker |

## Username Privacy Mode

Tracker Tracker includes an optional privacy mode (`Settings → Store Usernames`) that controls whether tracker usernames and user classes are persisted to the database.

| Mode | Behavior |
|---|---|
| **Enabled** (default) | Usernames and groups are stored as-is in `tracker_snapshots` |
| **Disabled** | Usernames and groups are replaced with a length-preserving mask (`▓N` where N = character count) before database write. Real values are never stored. |

When disabling, users can optionally **scrub historical data** to retroactively replace all previously stored usernames with their masked equivalents.

**Important caveat:** The character-count mask is not a strong anonymization technique. An investigator with access to both the Tracker Tracker database and a tracker's user database could cross-reference the character count of redacted usernames with other correlated data points (ratio, upload volume, account age, user class) to narrow down or identify the account. The mask raises the effort bar but does not provide mathematical anonymity. For strong protection against disk seizure, deploy on an encrypted filesystem (see [Deployment Hardening](#deployment-hardening)).

The test-connection flow (`POST /api/trackers/test`) always returns the real username for confirmation purposes. This value is ephemeral — it is displayed in the browser and never written to the database.

## Unmitigated Attack Vectors

The following attack vectors are **not fully mitigated** by Tracker Tracker's application-layer security. Users should understand these risks and apply the recommended countermeasures.

### 1. Disk Seizure / Physical Access

**Risk:** If an adversary gains physical access to the server or its storage, all unencrypted database fields are readable. This includes tracker names, base URLs, usernames (unless privacy mode is enabled), upload/download statistics, and ratio history. API tokens are protected by AES-256-GCM encryption, but all metadata is plaintext.

**Countermeasure:** Deploy the Docker volume on a LUKS-encrypted or dm-crypt-encrypted partition. This renders seized storage unreadable without the disk encryption passphrase. See [Deployment Hardening](#deployment-hardening).

### 2. Compromised Host / Memory Dump

**Risk:** If the host machine is compromised while Tracker Tracker is running, an attacker with root access can dump the Node.js process memory. The scrypt-derived encryption key is held in memory by the scheduler for the duration of the session. With this key, all encrypted API tokens can be decrypted.

**Countermeasure:** On logout or scheduler stop, the encryption key buffer is explicitly zero-filled (`Buffer.fill(0)`) to prevent it from lingering in process memory. This is defense-in-depth — V8's garbage collector may have created internal copies during compaction, and closures may retain references until collected. The zeroing eliminates the most direct and inspectable copy. Standard server hardening also applies: keep the OS patched, use SSH key auth, minimize attack surface, run the container as a non-root user.

### 3. Correlation Attack on Masked Usernames

**Risk:** Even with username privacy mode enabled, the character-count mask (`▓7` for a 7-character username) combined with other stored data points (ratio, upload volume, tracker name) may allow an investigator to correlate a masked entry with a specific account on the tracker's user database. Private trackers typically have small user populations (hundreds to low thousands), making this cross-referencing feasible.

**Countermeasure:** For maximum privacy, combine username privacy mode with full-disk encryption. Consider periodic data pruning via the retention policy to reduce the volume of historical data available for correlation.

### 4. Network Traffic Analysis

**Risk:** Even over HTTPS, an observer at the network level can see the IP addresses of tracker API endpoints that the application connects to. This reveals *which trackers* the user monitors, even though the request/response content is encrypted.

**Countermeasure:** Route outbound traffic through a VPN or Tor. This is outside the application's scope.

### 5. Tracker-Side Logging

**Risk:** Some tracker APIs pass authentication tokens in the URL query string: UNIT3D uses `?api_token=TOKEN`, GGn uses `?key=TOKEN`. The tracker's web server access logs will contain the full URL including the token. Gazelle trackers use `Authorization` headers (not logged by default). This is a protocol-level constraint that Tracker Tracker cannot mitigate.

**Countermeasure:** None at the application level. This is an upstream API design decision. Users should be aware that their API token may appear in the tracker's server logs depending on the platform.

## Backup Security

The backup/restore system (`src/lib/backup.ts`, `src/app/api/settings/backup/`) follows these security invariants:

### Data Handling

- **Encrypted fields travel as ciphertext** — `encryptedApiToken`, `totpSecret`, `encryptedProxyPassword`, `encryptedUsername`, `encryptedPassword` are never decrypted during backup generation. The backup contains the raw ciphertext from the database.
- **Password hash excluded** — `app_settings.password_hash` is never included in backup files. The restoring user's current password is preserved.
- **Encryption salt included** — `app_settings.encryption_salt` is included because it is required to re-derive the encryption key from the master password after restore.
- **Failed login counter reset** — `failedLoginAttempts` is always set to 0 on restore, regardless of the backup's value. This prevents a backup with an elevated counter from triggering auto-wipe on restore.

### Authentication

- All four backup routes (`export`, `restore`, `history`, `delete`) require a valid session via `authenticate()`.
- **Restore requires master password re-confirmation** — in addition to the session, the restore route verifies the master password. This is an intent confirmation gate, not a login attempt. Failed password verification does NOT increment the auto-wipe counter.

### Optional Encryption Layer

- When `backupEncryptionEnabled` is true, the entire backup JSON is wrapped in an additional AES-256-GCM layer using the session's encryption key (derived from `scrypt(masterPassword, encryptionSalt)`).
- This protects all fields (including plaintext metadata like tracker names and URLs) at rest.
- An encrypted backup (`.ttbak`) can only be restored with the same master password that created it.

### Restore Safety

- Restore executes inside a PostgreSQL transaction — on any failure, all changes are rolled back.
- The scheduler is stopped before restore begins (encryption key zeroed).
- After restore, the session is cleared and the user must re-login. This is a **cryptographic necessity**: the restored `encryptionSalt` differs from the current one, so the session's derived key is invalid.
- BigInt values are serialized as decimal strings (not JSON numbers) to avoid 53-bit integer truncation.

### File Security

- Backup files are pure JSON — no zip/tar archives, eliminating zip slip attack surface.
- Scheduled backups write to a configurable directory with `mkdir({ recursive: true })`.
- File deletion (via DELETE route or pruning) validates the resolved path against the configured `backupStoragePath` using `path.resolve()` + `startsWith(base + path.sep)` to prevent path traversal.
- On-demand exports are returned as a browser download **and** saved to the configured `backupStoragePath` on disk (with a `backupHistory` record). If disk write fails, the browser download still proceeds.

## Known Limitations

1. **No rate limiting on login**: Argon2 provides natural slowdown (~200ms/attempt) but there is no explicit brute force protection. If exposing to the internet, deploy behind a reverse proxy (Nginx, Caddy, Traefik) with rate limiting enabled.
2. **API token in URL parameter**: UNIT3D (`?api_token=TOKEN`) and GGn (`?key=TOKEN`) pass tokens in the URL query string, which may appear in the tracker's server access logs. Gazelle trackers use `Authorization` headers (not logged by default). This is an upstream protocol design constraint.
3. **No CSP header**: Content Security Policy is not yet configured due to the complexity of tuning it for ECharts canvas rendering. Basic security headers (X-Frame-Options, X-Content-Type-Options) are in place.
4. **Optional 2FA**: TOTP two-factor authentication is available but optional. Backup codes use SHA-256 + random salt (not Argon2 — high-entropy generated codes don't need memory-hard KDF).
5. **SESSION_SECRET truncation**: The session key uses only the first 32 bytes of `SESSION_SECRET`. Longer secrets work correctly but additional entropy beyond 32 characters is not used.

## Security Testing

Security invariants are verified by 80 automated tests in `src/lib/__tests__/security.test.ts`:

| Category | Tests | What's Verified |
|---|---|---|
| Auth enforcement | 52 | Every protected route returns 401 without valid session — trackers, snapshots, roles, reorder, poll-all, settings, dashboard, quicklinks, reset-stats, logs, clients (CRUD + test + torrents + snapshots + speeds), tag-groups (CRUD + members + member CRUD), fleet (snapshots + torrents), TOTP setup/confirm/disable, change-password, lockdown, nuke, proxy-test, backup (export + restore + history + get + delete), changelog, logout |
| Token leakage | 2 | `encryptedApiToken` never appears in API responses (list + detail) |
| Setup protection | 1 | Setup cannot be re-triggered after initial configuration |
| Input validation | 14 | URL scheme allowlist, hex color validation, poll interval clamping, oversized input rejection, API token max length, qBT tag max length, role name max length, notes max length, date format validation, tracker ID validation |
| Crypto integrity | 5 | Encrypt/decrypt round-trip, tampered ciphertext rejected, wrong key rejected, truncated ciphertext rejected, random IV uniqueness |
| Key zeroing | 2 | Encryption key buffer is zero-filled on scheduler stop; double-stop is safe |
| Backup auth | 4 | Export, restore, history, and delete routes return 401 without valid session |

Additional security-relevant tests exist across other test files.

Run the full test suite:

```sh
pnpm test:run
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. **Type check** (`pnpm tsc`) — catches type errors before runtime
2. **Full test suite** (`pnpm test:run`) — all 915 tests including security invariants
3. **Security test count guard** — fails the build if the security test count drops below 78, preventing accidental removal of security tests
4. **Static security audit** (`scripts/security-audit.ts`) — runs on every PR, comments results on the PR, and fails on critical findings

The count guard ensures that security coverage is monotonically non-decreasing. If a security test is removed or refactored, CI will fail until the count is restored or the threshold is explicitly updated.

### Static Security Audit

The security audit (`scripts/security-audit.ts`) performs 28 automated checks on every push and PR:

| # | Check | Severity | What's Verified |
|---|-------|----------|-----------------|
| 1 | Auth enforcement | Critical | Every non-public API route calls `authenticate()` or `getSession()` |
| 2 | Dangerous functions | Critical | No code-injection-risk functions in source |
| 3 | Hardcoded secrets | Critical | No AWS keys, private keys, PATs, or API keys in source |
| 4 | Security headers | Critical | All 6 required headers present in `next.config.ts` |
| 5 | Cookie security | Critical | All cookie operations use `httpOnly`, `sameSite: "strict"`, `secure` |
| 6 | Sensitive field exposure | Critical | `encryptedApiToken`, `passwordHash`, etc. not in API responses |
| 7 | Env files | Critical | No `.env` files tracked by git |
| 8 | Raw SQL in routes | Critical | No `db.execute()` in API route handlers (use Drizzle query builder) |
| 9 | Unsafe redirect/fetch | Critical | No `fetch()`/`redirect()` with user-supplied URLs in API routes (SSRF) |
| 10 | Timing-safe comparison | Critical | Secret comparisons in auth/crypto/totp use `timingSafeEqual` |
| 11 | No raw migrations | Critical | No SQL migration files — enforces schema-first Drizzle approach |
| 12 | Fetch timeout | Critical | All external HTTP requests in adapters/clients have `AbortSignal.timeout` |
| 13 | Dockerfile non-root | Critical | Docker container runs as non-root user with explicit `USER` directive |
| 14 | Proxy allowlist sync | Critical | Public routes in proxy allowlist match `NO_AUTH_ROUTES` bidirectionally |
| 15 | Console in routes | Warning | No `console.log/debug/info` in API route handlers |
| 16 | TODO in security files | Warning | No `TODO`/`FIXME` in security-critical source files |
| 17 | JSON.parse safety | Warning | `JSON.parse()` calls wrapped in try-catch |
| 18 | Bare catch blocks | Warning | No swallowed errors in API routes/lib catch blocks |
| 19 | Request body size | Warning | POST/PATCH/PUT handlers validate request body size |
| 20 | BigInt safety | Warning | BigInt fields use string serialization, not `Number()` |
| 21 | Path traversal defense | Critical | File delete operations use `path.resolve()` + `startsWith(base)` |
| 22 | Argon2 hashing | Critical | Password hashing in `auth.ts` uses Argon2, not SHA-256/bcrypt |
| 23 | Encrypted column writes | Critical | DB writes to encrypted columns use `encrypt()`/`reEncrypt()` |
| 24 | TOTP flow integrity | Critical | 2FA routes enforce correct auth patterns, token flows, and single-use backup codes |
| 25 | Lockdown flow integrity | Critical | Emergency lockdown stops scheduler, revokes tokens, rotates salt, clears TOTP |
| 26 | Nuke flow integrity | Critical | Scrub & delete requires session + password, uses `scrubAndDeleteAll()` |
| 27 | Backup restore integrity | Critical | Restore requires session + password (no auto-wipe), resets failed attempts, uses transaction |
| 28 | Login flow integrity | Critical | Login uses Argon2, atomic failed attempts, key derivation, TOTP pending token support |

Critical failures block the build. Warnings are reported but don't block.

#### Inline Suppression

Individual findings can be suppressed with an inline comment on the flagged line or the line above:

```ts
// security-audit-ignore: stream closed by client disconnect — nothing to recover
} catch { /* stream already closed */ }
```

Block comments also work: `/* security-audit-ignore: reason */`

**A reason is mandatory.** A bare `// security-audit-ignore` without a colon and explanation is itself a critical failure.

Run locally: `npx tsx scripts/security-audit.ts`

## Deployment Hardening

Recommendations for securing the Docker Compose deployment:

- **Encrypted filesystem:** Mount the PostgreSQL data volume on a LUKS-encrypted partition. This is the single most effective defense against disk seizure.
- **Non-root container:** The Dockerfile runs as `nextjs` (UID 1001). Verify with `docker exec <container> whoami`.
- **Read-only filesystem:** Mount the application container's root filesystem as read-only (`read_only: true` in docker-compose) with tmpfs for `/tmp`.
- **Network isolation:** Place PostgreSQL on an internal Docker network with no published ports. Only the application container should reach the database.
- **Reverse proxy:** Deploy behind Nginx, Caddy, or Traefik with TLS termination and rate limiting on `/api/auth/login`.
- **`NODE_ENV=production`:** Required for the `secure` cookie flag and Next.js production optimizations.
- **`SESSION_SECRET`:** Must be at least 32 characters of cryptographically random data. Generate with: `openssl rand -base64 48`.

## Security Review Checklist

Run this checklist when adding new features, modifying API routes, or before releases. Each item references the specific file or pattern to verify.

### Pre-Flight (run every PR)

```sh
pnpm tsc                              # Type safety
pnpm test:run                         # Full test suite (including 78+ security tests)
npx tsx scripts/security-audit.ts     # Static security audit (28 checks)
```

### 1. Authentication & Authorization

- [ ] Every new API route calls `authenticate()` from `src/lib/api-helpers.ts` as its first operation
- [ ] No new public routes added without updating the proxy allowlist in `src/proxy.ts` (lines 12-14)
- [ ] `authenticate()` failure returns `NextResponse.json({ error }, { status: 401 })` — no fallthrough
- [ ] Destructive operations (nuke, lockdown, restore) require additional password verification beyond the session
- [ ] TOTP-protected flows use the pending token pattern (60s JWE), not direct session issuance
- [ ] New settings or admin actions do NOT bypass the three-layer defense: proxy -> layout -> route handler

### 2. Input Validation

- [ ] All user-supplied strings have a maximum length (`str.length > N` -> 400)
- [ ] URL inputs validated with `new URL()` + scheme restricted to `http://` or `https://`
- [ ] Color inputs validated against hex pattern (`/^#[0-9a-fA-F]{3,8}$/`)
- [ ] Numeric inputs parsed and bounds-checked (e.g., poll interval clamped to 15-1440)
- [ ] Date inputs regex-validated (`/^\d{4}-\d{2}-\d{2}$/`) or null
- [ ] ID parameters parsed as integers with `Number()` + `Number.isNaN()` check
- [ ] Platform type validated against allowlist, not open string
- [ ] No user input concatenated into SQL — all queries use Drizzle ORM's parameterized API
- [ ] File paths from user input validated with `path.resolve()` + `startsWith(basePath + path.sep)`

### 3. XSS Prevention

- [ ] Zero uses of unsafe HTML injection methods in source files (innerHTML assignment, etc.)
- [ ] Zero uses of code-injection-risk functions in source files
- [ ] All user data rendered through JSX interpolation (`{value}`), never as raw HTML
- [ ] ECharts tooltip `formatter` functions only render app-computed data, not raw user strings
- [ ] No script tags dynamically constructed from user input
- [ ] The static security audit (`scripts/security-audit.ts` check #2) passes

### 4. Encryption & Secrets

- [ ] API tokens stored via `encrypt()` from `src/lib/crypto.ts` — never plaintext in the database
- [ ] `encryptedApiToken` excluded from ALL API response objects (grep for `// SECURITY` comments)
- [ ] `passwordHash` never included in API responses or backup exports
- [ ] Encrypted credentials (`encryptedUsername`, `encryptedPassword`, `encryptedProxyPassword`) excluded from responses
- [ ] Password change route re-encrypts all secrets with the new derived key
- [ ] `SESSION_SECRET` is at least 32 characters (checked at startup)
- [ ] No secrets in `console.log`, `console.error`, or logger calls — hostnames only, never full URLs with tokens
- [ ] Error messages from adapter-fetch sanitize to hostname only (no token leakage in stack traces)

### 5. Session Security

- [ ] Session cookie set with: `httpOnly: true`, `sameSite: "strict"`, `secure: NODE_ENV === "production"`, `path: "/"`
- [ ] Session has hard expiry (7 days) encoded in the JWE payload — not just cookie `maxAge`
- [ ] Logout zero-fills the encryption key buffer before destroying the session
- [ ] Login returns the encryption key only inside the JWE session — never in the response body
- [ ] Failed login attempts increment atomically via `recordFailedAttempt()` in `src/lib/wipe.ts`

### 6. External Requests

- [ ] All outbound HTTP requests have a timeout (`AbortSignal.timeout(15_000)` or equivalent)
- [ ] Tracker URLs validated at creation time — no open redirects or protocol switching
- [ ] Proxy-required trackers (`useProxy: true`) throw if proxy is unavailable — no fallback to direct connection
- [ ] qBT client connections validate host/port — no SSRF via user-configured client addresses
- [ ] No user-controlled data in `Authorization` headers beyond the stored (encrypted) API token

### 7. Database Operations

- [ ] All queries use Drizzle ORM — no raw SQL strings with interpolated values
- [ ] BigInt values serialized as decimal strings in JSON (not `Number()` which truncates at 2^53)
- [ ] Backup restore runs inside a transaction — partial failures roll back cleanly
- [ ] `scrubAndDeleteAll` overwrites sensitive columns with random bytes before deletion + `VACUUM FULL`
- [ ] Failed login counter uses atomic SQL (update + returning) — no TOCTOU race

### 8. File Operations

- [ ] File read/delete operations validate resolved path against base directory + `path.sep`
- [ ] Backup format is pure JSON — no zip/tar archives (eliminates zip slip surface)
- [ ] No shell commands with user-supplied arguments
- [ ] Scheduled backup filenames are server-generated (timestamp-based) — not user-controlled

### 9. Security Headers

Verify in `next.config.ts`:

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `X-DNS-Prefetch-Control: off`

### 10. Docker & Deployment

- [ ] Container runs as non-root user (UID 1001 `nextjs`)
- [ ] `NODE_ENV=production` set in Docker Compose
- [ ] PostgreSQL on internal network — no published ports
- [ ] No `.env` files tracked by git (checked by security audit #7)
- [ ] `scripts/reset-password-nuclear.mjs` not included in production Docker image

### Quick Verification Commands

```sh
# Run static security audit (covers XSS, auth, secrets, headers)
npx tsx scripts/security-audit.ts

# Verify all API routes authenticate (files missing authenticate/getSession)
grep -rL 'authenticate\|getSession' src/app/api/**/route.ts

# Count security tests (must be >= 78)
pnpm test:run -- src/lib/__tests__/security.test.ts 2>&1 | grep 'Tests'
```

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT open a public issue** for critical/high severity findings
2. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository
3. Alternatively, contact the maintainer directly via the email in the git commit history
4. Include: description, reproduction steps, impact assessment, and suggested fix if possible
5. Allow reasonable time for a fix before public disclosure
