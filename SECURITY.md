<!-- SECURITY.md -->

# Security Architecture

Last audited: `2026-03-17`

- [Security Architecture](#security-architecture)
  - [For Users](#for-users)
    - [Authentication](#authentication)
    - [Data Classification](#data-classification)
    - [Encryption at Rest](#encryption-at-rest)
    - [Route Protection](#route-protection)
    - [Data Protection](#data-protection)
    - [Input Validation](#input-validation)
    - [Security Response Headers](#security-response-headers)
    - [Threat Model](#threat-model)
    - [Is There Any Telemetry Baked In?](#is-there-any-telemetry-baked-in)
    - [Username Privacy Mode](#username-privacy-mode)
    - [Known Limitations](#known-limitations)
    - [Unmitigated Attack Vectors](#unmitigated-attack-vectors)
      - [1. Disk Seizure / Physical Access](#1-disk-seizure--physical-access)
      - [2. Compromised Host / Memory Dump](#2-compromised-host--memory-dump)
      - [3. Correlation Attack on Masked Usernames](#3-correlation-attack-on-masked-usernames)
      - [4. Network Traffic Analysis](#4-network-traffic-analysis)
      - [5. Tracker-Side Logging](#5-tracker-side-logging)
      - [6. DNS Rebinding](#6-dns-rebinding)
    - [Backup Security](#backup-security)
      - [Data Handling](#data-handling)
      - [Authentication](#authentication-1)
      - [Optional Encryption Layer](#optional-encryption-layer)
      - [Restore Safety](#restore-safety)
      - [File Security](#file-security)
    - [Deployment Hardening](#deployment-hardening)
    - [Vulnerability Reporting](#vulnerability-reporting)
  - [For Contributors](#for-contributors)
    - [Security Testing](#security-testing)
    - [CI Integration](#ci-integration)
    - [Static Security Audit](#static-security-audit)
      - [Inline Suppression](#inline-suppression)
    - [Security Review Checklist](#security-review-checklist)
      - [Pre-Flight (run every PR)](#pre-flight-run-every-pr)
      - [1. Authentication \& Authorization](#1-authentication--authorization)
      - [2. Input Validation](#2-input-validation)
      - [3. XSS Prevention](#3-xss-prevention)
      - [4. Encryption \& Secrets](#4-encryption--secrets)
      - [5. Session Security](#5-session-security)
      - [6. External Requests](#6-external-requests)
      - [7. Database Operations](#7-database-operations)
      - [8. File Operations](#8-file-operations)
      - [9. Security Headers](#9-security-headers)
      - [10. Docker \& Deployment](#10-docker--deployment)
      - [Quick Verification Commands](#quick-verification-commands)
    - [Huntarr Anti-Pattern Checklist](#huntarr-anti-pattern-checklist)

---

## For Users

---

### Authentication

- **Password hashing**: Argon2 (memory-hard KDF) in `src/lib/auth.ts`
- **Session tokens**: Encrypted JWE (A256GCM) via `jose` in `src/lib/auth.ts`
- **Cookie security**: httpOnly, secure (when BASE_URL is HTTPS or SECURE_COOKIES=true), sameSite=strict, 7-day hard expiry
- **Password policy**: 8-128 characters enforced on setup and login
- **Username**: Optional login username (6-100 chars), case-insensitive
- **TOTP 2FA**: Optional TOTP via `otpauth` (SHA1, 6 digits, 30s period, ±1 window). Secret encrypted at rest with AES-256-GCM. Stateless enrollment via JWE setup tokens (5min TTL).
- **Backup codes**: 8 codes in XXXX-XXXX hex format, hashed with SHA-256 + random salt, encrypted at rest. Each code is single-use.
- **Two-step login**: When TOTP is enabled, login returns a pending token (60s JWE). The client sends the pending token + TOTP code to complete authentication.
- **Auth model**: No whitelist or bypass. Every API route independently calls `authenticate()`, which decrypts the JWE session and checks its master-key fingerprint against `app_settings`.

---

### Data Classification

| Data                   | Storage                                 | Encrypted                                                       | Justification                                                                                        |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Master password        | `app_settings.password_hash`            | Argon2 hash (irreversible)                                      | Memory-hard KDF; cannot be reversed                                                                  |
| Tracker API tokens     | `trackers.encrypted_api_token`          | AES-256-GCM                                                     | Most sensitive field; provides account access                                                        |
| Mousehole API token    | `trackers.encrypted_mousehole_token`    | AES-256-GCM                                                     | Mousehole's MOUSEHOLE_AUTH_TOKEN; leaves the server only as a Bearer header to Mousehole             |
| Encryption key         | JWE session cookie + scheduler memory   | JWE (A256GCM)                                                   | In-memory copy zero-filled on destructive operations; wrapped copy persisted in DB for boot recovery |
| Scheduler key          | `app_settings.encrypted_scheduler_key`  | AES-256-GCM (wrapped with HKDF-derived key from SESSION_SECRET) | Enables 24/7 polling; persists through logout; cleared on lockdown/nuke/password-change              |
| Encryption salt        | `app_settings.encryption_salt`          | No                                                              | Salt is not secret; useless without master password                                                  |
| Tracker names          | `trackers.name`                         | No                                                              | User-assigned label; not inherently identifying                                                      |
| Tracker base URLs      | `trackers.base_url`                     | No                                                              | Reveals which trackers the user monitors                                                             |
| Tracker usernames      | `tracker_snapshots.username`            | No                                                              | Written each poll; from the tracker, or from the encrypted credential when the tracker omits it      |
| User class/group       | `tracker_snapshots.group_name`          | No                                                              | Fetched fresh from tracker API on each poll                                                          |
| Upload/download stats  | `tracker_snapshots.*_bytes`             | No                                                              | Numeric time-series; meaningful only with context                                                    |
| Ratio, seedbonus, H&Rs | `tracker_snapshots.*`                   | No                                                              | Numeric time-series; meaningful only with context                                                    |
| Session cookie         | Browser (`tt_session`)                  | JWE (A256GCM)                                                   | httpOnly, secure, sameSite=strict                                                                    |
| TOTP secret            | `app_settings.totp_secret`              | AES-256-GCM                                                     | TOTP enrollment secret; compromised = account takeover                                               |
| Proxy password         | `app_settings.encrypted_proxy_password` | AES-256-GCM                                                     | Proxy service credential                                                                             |
| qBT credentials        | `download_clients.encrypted_*`          | AES-256-GCM                                                     | Download client authentication                                                                       |
| Prowlarr API keys      | `prowlarr_instances.encrypted_api_key`  | AES-256-GCM                                                     | Full access to Prowlarr; NULL or ciphertext; leaves the server only as an X-Api-Key header           |
| Notification config    | `notification_targets.encrypted_config` | AES-256-GCM                                                     | Webhook URLs and service tokens for alerts                                                           |
| Backup files           | Filesystem (optional)                   | AES-256-GCM (optional)                                          | Contains all data including encrypted fields as ciphertext                                           |

**Disk seizure note:** If an adversary accesses the raw database files, all unencrypted fields above are readable. Deploy on an encrypted filesystem (LUKS, dm-crypt, or equivalent). See [Known Limitations](#known-limitations).

---

### Encryption at Rest

All tracker API tokens are encrypted before database storage. See `src/lib/crypto.ts`.

| Parameter      | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Algorithm      | AES-256-GCM                                               |
| Key derivation | scrypt (N=16384, r=8, p=1)                                |
| IV             | 12 bytes random per encryption                            |
| Auth tag       | 16 bytes                                                  |
| Salt           | 32 bytes random, stored in `app_settings.encryption_salt` |

The encryption key is derived from the master password on login and stored in the encrypted JWE session. It is never persisted to disk in plaintext.

The session also carries a SHA-256 fingerprint of `password_hash` and `encryption_salt`, taken from the row that verified the password. Every session read compares it with the current row, so a password change, an emergency lockdown or a `tt-recover` reset signs out every session minted before it. Sessions minted before the fingerprint existed are refused too.

The scheduler key (used to decrypt API tokens during background polling) is wrapped with a separate HKDF-derived key from `SESSION_SECRET` and stored in `appSettings.encryptedSchedulerKey`. This enables polling to run 24/7, surviving both container restarts and user logouts. The key is only cleared on destructive operations: lockdown, nuke, password change, and restore. If `SESSION_SECRET` is rotated, the stored key becomes undecryptable and polling will resume after the next login.

---

### Route Protection

Authentication is enforced at three independent levels:

1. **Proxy** (`src/proxy.ts`): Checks for `tt_session` cookie on all non-public routes. Returns 401 for API routes; redirects to `/login` for pages.
2. **Route handlers**: Each API route calls `authenticate()` from `src/lib/api-helpers.ts`, which decrypts the full JWE token and refuses it unless its fingerprint matches the current password hash and salt. A refused stale session gets its cookie cleared.
3. **Layout guard** (`src/app/(auth)/layout.tsx`): Server Component calls `getSession()` before rendering any authenticated page.

Public routes are explicitly limited to: `/login`, `/setup`, `/api/auth/*`, `/api/health`.

---

### Data Protection

- `encryptedApiToken`, `encryptedCredentials` and `encryptedMouseholeToken` are never included in API responses. `serializeTrackerResponse()` in `src/lib/tracker-serializer.ts` uses an allowlist pattern, so they are structurally unreachable from the response object. The Mousehole token is reduced to `hasMouseholeToken` in SQL by `trackerColumns` in `src/lib/server-data.ts`.
- All database queries use Drizzle ORM (parameterized queries, no SQL injection surface).
- No unsafe HTML injection methods anywhere in the codebase.
- **Emergency lockdown** (`POST /api/settings/lockdown`): Stops scheduler, revokes all API tokens, clears credential vaults, Mousehole API tokens and Prowlarr API keys (disabling each Prowlarr instance), rotates encryption salt, wipes TOTP/username, and signs out every session, since none of them matches the new salt. Requires active session and three-checkbox UI acknowledgment.
- **Scrub & delete** (`POST /api/settings/nuke`): Overwrites sensitive columns with random bytes, then deletes all rows. Requires active session + master password. Disk reclamation handled by PostgreSQL autovacuum.
- **Backup/restore**: Pure JSON format (no zip/tar). Restore validates all fields before database writes. File deletion uses `path.resolve()` + base directory prefix check. Restore requires master password re-confirmation. Encrypted fields travel as ciphertext. See [Backup Security](#backup-security).
- External HTTP requests use `AbortSignal.timeout(15_000)`. See `src/lib/tracker-platforms/helpers/adapter-fetch.ts`.
- Error messages sanitize hostnames and do not leak full URLs containing API tokens.

---

### Input Validation

All API routes validate inputs. See `src/app/api/trackers/route.ts` and `src/app/api/trackers/[id]/route.ts`.

| Field           | Constraint                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| Tracker name    | string, max 100 chars, trimmed                                                           |
| Tracker         | registry slug; must name a registry entry, which supplies the URL, platform and API path |
| API token       | string; 500 chars for an API key, 5000 for cookie, uid-pass and login credentials        |
| Color           | hex color format only (`#[0-9a-fA-F]{3,8}`), rejects arbitrary strings                   |
| qBittorrent tag | string, max 100 chars, trimmed                                                           |
| Poll interval   | integer, clamped to 15-1440 minutes                                                      |
| Tracker ID      | parsed as integer, NaN rejected                                                          |
| Platform type   | set by the registry entry; a slugless connection test checks `VALID_PLATFORM_TYPES`      |
| Password        | string, 8-128 chars                                                                      |
| Role name       | string, max 255 chars                                                                    |
| joinedAt        | regex-validated YYYY-MM-DD or null                                                       |
| Notes (roles)   | string, max 2000 chars                                                                   |

---

### Security Response Headers

Configured in `next.config.ts` for all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'` (the modern form of the same rule; both are sent)
- `X-XSS-Protection: 0` (disables legacy XSS auditor; prevents IE/Edge quirks)
- `X-DNS-Prefetch-Control: off` (prevents DNS prefetching which can leak browsing activity)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

### Threat Model

| Property         | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| User model       | Single user, self-hosted                                                                  |
| Deployment       | Docker Compose (open-source)                                                              |
| Trust boundary   | Network perimeter; may be internet-facing behind reverse proxy                            |
| Primary threats  | Unauthorized access, credential leakage, supply chain                                     |
| External calls   | User-configured tracker URLs (UNIT3D, Gazelle, GGn, Nebulance APIs) + qBittorrent clients |
| Data sensitivity | Tracker API tokens (encrypted), usage statistics                                          |

---

### Is There Any Telemetry Baked In?

Nope 😎

---

### Username Privacy Mode

Optional privacy mode (`Settings → Store Usernames`) controls whether tracker usernames and user classes are persisted to the database.

| Mode                  | Behavior                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enabled** (default) | Usernames and groups are stored as-is in `tracker_snapshots`                                                                                          |
| **Disabled**          | Usernames and groups are replaced with a length-preserving mask (`▓N` where N = character count) before database write. Real values are never stored. |

When disabling, you can optionally scrub historical data to retroactively replace all previously stored usernames with their masked equivalents.

The character-count mask is not strong anonymization. An investigator with database access could cross-reference the character count with ratio, upload volume, and user class to narrow down the account. For stronger protection, combine privacy mode with full-disk encryption (see [Deployment Hardening](#deployment-hardening)).

The test-connection flow (`POST /api/trackers/test`) always returns the real username for confirmation. This value is ephemeral. It is displayed in the browser and never written to the database.

---

### Known Limitations

1. **Progressive lockout only (no IP-based rate limiting)**: Failed login and TOTP attempts trigger escalating lockouts (5 attempts → 30s, 10 → 2min, 15 → 15min, 20 → 1hr) via `getProgressiveLockoutMs()` in `src/lib/wipe.ts`. The counter is global (not per-IP), so an unauthenticated attacker can lock out the legitimate user. Deploy behind a reverse proxy with per-IP rate limiting on `/api/auth/login` for additional protection.
2. **API token in URL parameter**: UNIT3D (`?api_token=TOKEN`) and GGn (`?key=TOKEN`) pass tokens in the query string, which may appear in the tracker's server access logs. Gazelle trackers use `Authorization` headers (not logged by default). Upstream limitation.
3. **No full CSP**: only `frame-ancestors 'none'` is set; a full Content Security Policy is not yet configured due to ECharts canvas rendering complexity. Basic headers (X-Frame-Options, X-Content-Type-Options) are in place.
4. **Optional 2FA**: TOTP is available but not required. Backup codes use SHA-256 + random salt (not Argon2, since high-entropy generated codes don't need a memory-hard KDF).
5. **DNS rebinding not mitigated at fetch time**: SSRF protection validates hostnames when a user-entered address is saved (download clients, proxy, Mousehole URL, Prowlarr), not when outbound requests are made; tracker addresses come from the registry. See [Unmitigated Attack Vectors](#6-dns-rebinding) for details.
6. **Scheduler key persisted in DB**: The encryption key is wrapped with an HKDF-derived key from `SESSION_SECRET` and stored in `appSettings` to enable 24/7 polling. An attacker with both database access and `SESSION_SECRET` could unwrap the key and decrypt all API tokens. For Docker Compose deployments, `SESSION_SECRET` is in the same trust boundary as DB credentials. Deploy on an encrypted filesystem for defense against disk seizure. Rotating `SESSION_SECRET` invalidates the stored key, and polling resumes after the next login.
7. **Client IP in auth logs**: Failed and successful login attempts include the client IP (from `CF-Connecting-IP` or the rightmost `X-Forwarded-For` entry) in server log lines. IPs are never stored in the database. To suppress, configure your reverse proxy to strip these headers before forwarding to the app, or set `LOG_LEVEL=error` to disable info/warn log events entirely.

---

### Unmitigated Attack Vectors

These vectors are not fully mitigated at the application layer. Apply the recommended countermeasures at the infrastructure level.

#### 1. Disk Seizure / Physical Access

**Risk:** Physical access to the server exposes all unencrypted database fields: tracker names, base URLs, usernames (unless privacy mode is enabled), and usage statistics. API tokens are AES-256-GCM protected, but all metadata is plaintext.

**Countermeasure:** Deploy the Docker volume on a LUKS- or dm-crypt-encrypted partition. See [Deployment Hardening](#deployment-hardening).

#### 2. Compromised Host / Memory Dump

**Risk:** Root access to a running host allows process memory dumps. The scrypt-derived encryption key is held in scheduler memory for the session duration. With this key, all encrypted API tokens can be decrypted.

**Countermeasure:** On scheduler stop (triggered by lockdown, nuke, password change, or restore), the encryption key buffer is explicitly zero-filled (`Buffer.fill(0)`). Logout does not zero the key, because the scheduler persists through logout for 24/7 polling. V8 may have created internal copies during GC compaction, but those are not directly inspectable. Standard server hardening also applies: patched OS, SSH key auth, non-root container.

#### 3. Correlation Attack on Masked Usernames

**Risk:** The character-count mask (`▓7` for a 7-character username) combined with ratio, upload volume, and tracker name may allow cross-referencing against a tracker's user database. Private trackers typically have small populations (hundreds to low thousands), making this feasible.

**Countermeasure:** Combine username privacy mode with full-disk encryption. Use the retention policy to limit historical data available for correlation.

#### 4. Network Traffic Analysis

**Risk:** Even over HTTPS, a network observer can see the IP addresses of tracker API endpoints, revealing which trackers the user monitors.

**Countermeasure:** Route outbound traffic through a VPN or Tor. This is outside the application's scope.

#### 5. Tracker-Side Logging

**Risk:** UNIT3D uses `?api_token=TOKEN` and GGn uses `?key=TOKEN`, so the full URL including the token appears in the tracker's server access logs. Gazelle uses `Authorization` headers (not logged by default). Upstream limitation.

**Countermeasure:** None at the application level. Users should be aware that API tokens may appear in tracker server logs depending on the platform.

**Risk:** Outbound requests to JSON tracker APIs, and every request for a session the app logs in for itself with the user's password (TorrentLeech, Luminance), identify the application, sending `User-Agent: tracker-tracker/<major>.<minor>` (for example `tracker-tracker/2.10`). A tracker that prohibits third-party stat tools can find that string in its access logs, and Luminance also stores the User-Agent of each login on the account.

**Countermeasure:** The patch version is deliberately omitted. An exact version is a rare enough string to link one user's accounts across several trackers reached through the same proxy exit IP; major.minor is common enough not to. Adapters that authenticate with a browser-copied session send that browser's own User-Agent instead, with the headers a browser sends on a page load, so the identifying string never appears alongside a scraped session. A session the app logged in for itself was never a browser's, so it does not claim to be one. Users on trackers that forbid automated access should check the rules before polling.

#### 6. DNS Rebinding

**Risk:** SSRF protection in `src/lib/network.ts` validates hostnames at configuration time, not at request time. An attacker with DNS control could register a domain that resolves to a public IP during validation, then change it to a private IP before the next poll cycle.

**Countermeasure:** Low risk: a single user, tracker addresses come from the registry, and the manually entered addresses are the download client, proxy, Mousehole and Prowlarr ones. Private and loopback hosts are allowed for download clients and Prowlarr, since that is where they run. Deploy on an isolated network segment where the container cannot reach internal services. A future enhancement could add DNS resolution validation at fetch time.

---

### Backup Security

The backup/restore system (`src/lib/backup.ts`, `src/app/api/settings/backup/`) maintains the following invariants:

#### Data Handling

- **Encrypted fields travel as ciphertext**: `encryptedApiToken`, `encryptedCredentials`, `encryptedMouseholeToken`, `totpSecret`, `encryptedProxyPassword`, `encryptedUsername`, `encryptedPassword`, `encryptedUrlPath`, `downloadClients[].encryptedApiKey`, `prowlarrInstances[].encryptedApiKey`, `encryptedConfig` are never decrypted during backup generation.
- **Password hash excluded**: `app_settings.password_hash` is never included in backup files. The restoring user's current password is preserved.
- **Encryption salt included**: required to re-derive the encryption key from the master password after restore.
- **Failed login counter reset**: `failedLoginAttempts` is always set to 0 on restore, regardless of the backup's value.

#### Authentication

- All four backup routes (`export`, `restore`, `history`, `delete`) require a valid session via `authenticate()`.
- **Restore requires master password re-confirmation**: failed verification increments the failed login counter and triggers lockout.

#### Optional Encryption Layer

When `backupEncryptionEnabled` is true, the entire backup JSON is wrapped in an additional AES-256-GCM layer using the session's encryption key. An encrypted backup (`.ttbak`) can only be restored with the same master password that created it.

#### Restore Safety

- Restore executes inside a PostgreSQL transaction, so any failure rolls back all changes.
- The scheduler is stopped before restore begins (encryption key zeroed).
- The session remains valid after restore. The current `encryptionSalt` and `passwordHash` are preserved in place rather than overwritten. Encrypted fields are re-encrypted from the backup's salt to the current salt via `reencryptField()`.
- BigInt values are serialized as decimal strings (not JSON numbers) to avoid 53-bit integer truncation.

#### File Security

- Backup files are pure JSON rather than zip or tar archives, so there is no zip slip attack surface.
- Scheduled backups write to a configurable directory with `mkdir({ recursive: true })`.
- File deletion validates the resolved path against `backupStoragePath` using `path.resolve()` + `startsWith(base + path.sep)`.
- On-demand exports are returned as a browser download and saved to the configured `backupStoragePath`. If the disk write fails, the browser download still proceeds.

---

### Deployment Hardening

- **Encrypted filesystem:** Mount the PostgreSQL data volume on a LUKS-encrypted partition. This is the most effective defense against disk seizure.
- **Non-root container:** The Dockerfile runs as `nextjs` (UID 1001). Verify with `docker exec <container> whoami`.
- **Read-only filesystem:** Mount the application container root as read-only (`read_only: true` in docker-compose) with tmpfs for `/tmp`.
- **Network isolation:** Place PostgreSQL on an internal Docker network with no published ports.
- **Reverse proxy:** Deploy behind Nginx, Caddy, or Traefik with TLS termination and rate limiting on `/api/auth/login`.
- **`NODE_ENV=production`:** Required for Next.js production optimizations. Cookie `secure` flag is controlled separately via `BASE_URL` scheme or `SECURE_COOKIES=true`.
- **`SESSION_SECRET`:** Minimum 32 characters of cryptographically random data. Generate with: `openssl rand -base64 48`.

---

### Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT open a public issue** for critical/high severity findings.
2. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository.
3. Alternatively, contact the maintainer directly via the email in the git commit history.
4. Include: description, reproduction steps, impact assessment, and suggested fix if possible.
5. Allow reasonable time for a fix before public disclosure.

---

## For Contributors

---

### Security Testing

Security invariants are verified by automated tests in `src/lib/__tests__/security.test.ts`:

| Category         | Tests | What's Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth enforcement | 70    | Every protected route returns 401 without a valid session: trackers (CRUD + debug + poll + resume + test + snapshots + roles + torrents + avatar), reorder, poll-all, settings, dashboard, quicklinks, reset-stats, logs (read + download + delete), events, db-size, image-hosts, upload-image, clients (CRUD + test + torrents + snapshots + speeds), tag-groups (CRUD + members + member CRUD), fleet (snapshots + torrents), dismissed alerts, notifications (CRUD + test), TOTP setup/confirm/disable, change-password, lockdown, nuke, proxy-test, backup (export + restore + history + get + delete), changelog, logout |
| Token leakage    | 5     | Encrypted values never appear in API responses: `encryptedApiToken` (tracker list + detail, which also omits `apiPath`), notification `encryptedConfig`, and image hosting keys (settings, and image-hosts returns booleans)                                                                                                                                                                                                                                                                                                                                                                                                   |
| Setup protection | 1     | Setup cannot be re-triggered after initial configuration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Input validation | 11    | Tracker slugs must be in the registry, the stored URL comes from the registry rather than a `javascript:` or `data:` baseUrl in the body, hex color validation, qBT tag max length, role name max length, notes max length, date format validation, tracker ID validation                                                                                                                                                                                                                                                                                                                                                      |
| Key zeroing      | 3     | Encryption key buffer is zero-filled on scheduler stop; stopping with no scheduler running is safe; the SIGTERM handler is registered on import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Backup restore   | 11    | Wrong password returns 401 and records a failed attempt; bad JSON, bad structure, a missing password and an oversized file return 400; a master password under `PASSWORD_MIN` returns 400; a key derivation failure returns 500; the scheduler restarts after a rolled-back restore; notify* columns survive a round-trip and default to false from an older backup                                                                                                                                                                                                                                                            |
| Crypto failures  | 3     | Login, TOTP verify and backup export return 500 when a password hash check or decrypt fails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Additional security-relevant tests exist across other test files. `src/lib/crypto.test.ts` covers encryption integrity, including round-trips, tampered or truncated ciphertext, a wrong key, and random IV uniqueness.

Run the full test suite:

```sh
pnpm test:run
```

---

### CI Integration

Two GitHub Actions workflows run on every PR to `main` or `development` and on every push to `main`. `.github/workflows/ci.yml` runs steps 1 and 2, and `.github/workflows/security-audit.yml` runs steps 3 and 4:

1. **Type check** (`pnpm tsc`) catches type errors before runtime
2. **Full test suite** (`pnpm test:run`) runs every test, security invariants included
3. **Security test count guard** fails the build if `security.test.ts` holds fewer tests than the minimum set in `security-audit.yml`, so security tests cannot be removed by accident
4. **Static security audit** (`scripts/security-audit.ts`) posts results to the PR, or to the job summary for a fork, and fails on critical findings. A second guard fails the build if the audit runs fewer checks than its minimum.

The count guards ensure security coverage is monotonically non-decreasing. If a security test or audit check is removed or refactored, CI fails until the count is restored or the threshold is explicitly updated.

---

### Static Security Audit

The security audit (`scripts/security-audit.ts`) performs 38 automated checks on every PR and every push to `main`:

| #   | Check                    | Severity | What's Verified                                                                       |
| --- | ------------------------ | -------- | ------------------------------------------------------------------------------------- |
| 1   | Auth enforcement         | Critical | Every non-public API route calls `authenticate()`, `getSession()` or `readSession()`  |
| 2   | Dangerous functions      | Critical | No code-injection-risk functions in source                                            |
| 3   | Hardcoded secrets        | Critical | No AWS keys, private keys, PATs, or API keys in source                                |
| 4   | Security headers         | Critical | All 7 required headers present in `next.config.ts`                                    |
| 5   | Cookie security          | Critical | All cookie operations use `httpOnly`, `sameSite: "strict"`, `secure`                  |
| 6   | Sensitive field exposure | Critical | `encryptedApiToken`, `passwordHash`, etc. not in API responses                        |
| 7   | Env files                | Critical | No `.env` files tracked by git                                                        |
| 8   | Raw SQL in routes        | Critical | No `db.execute()` in API route handlers (use Drizzle query builder)                   |
| 9   | Unsafe redirect/fetch    | Critical | No `fetch()`/`redirect()` with user-supplied URLs in API routes (SSRF)                |
| 10  | Timing-safe comparison   | Critical | Secret comparisons in auth/crypto/totp use `timingSafeEqual`                          |
| 11  | No raw migrations        | Critical | No SQL migration files, which enforces the schema-first Drizzle approach              |
| 12  | Fetch timeout            | Critical | All external HTTP requests in adapters/clients have `AbortSignal.timeout`             |
| 13  | Dockerfile non-root      | Critical | Docker container runs as non-root user with explicit `USER` directive                 |
| 14  | Proxy allowlist sync     | Critical | Public routes in proxy allowlist match `NO_AUTH_ROUTES` bidirectionally               |
| 15  | Console in routes        | Warning  | No `console.log/debug/info` in API route handlers                                     |
| 16  | TODO in security files   | Warning  | No `TODO`/`FIXME` in security-critical source files                                   |
| 17  | JSON.parse safety        | Warning  | `JSON.parse()` calls wrapped in try-catch                                             |
| 18  | Bare catch blocks        | Warning  | Catch bodies in API routes and `src/lib` log, rethrow, or return                      |
| 19  | Request body size        | Warning  | POST/PATCH/PUT handlers validate request body size                                    |
| 20  | BigInt safety            | Warning  | BigInt fields use string serialization, not `Number()`                                |
| 21  | Path traversal defense   | Critical | File delete operations use `path.resolve()` + `startsWith(base)`                      |
| 22  | Argon2 hashing           | Critical | Password hashing in `auth.ts` uses Argon2, not SHA-256/bcrypt                         |
| 23  | Encrypted column writes  | Critical | DB writes to encrypted columns use `encrypt()`/`reencrypt()`                          |
| 24  | TOTP flow integrity      | Critical | 2FA routes enforce correct auth patterns, token flows, and single-use backup codes    |
| 25  | Lockdown flow integrity  | Critical | Emergency lockdown stops scheduler, revokes tokens, rotates salt, clears TOTP         |
| 26  | Nuke flow integrity      | Critical | Scrub & delete requires session + password, uses `scrubAndDeleteAll()`                |
| 27  | Backup restore integrity | Critical | Restore requires session + password, resets failed attempts, uses transaction         |
| 28  | Login flow integrity     | Critical | Login uses Argon2, atomic failed attempts, key derivation, TOTP pending token support |
| 29  | Auth result gating       | Critical | Handlers check the `authenticate()`, `getSession()` or `readSession()` result         |
| 30  | Backup password bounds   | Critical | Backup export and restore cap the password length before `deriveKey()`                |
| 31  | Webhook redirect policy  | Critical | Every `fetch()` in `notifications/deliver.ts` sets `redirect: "error"`                |
| 32  | Session secret length    | Critical | `getSessionKey()` and `deriveWrappingKey()` reject a `SESSION_SECRET` under 32 chars  |
| 33  | Notification SSRF check  | Critical | Every active notification type in `validate.ts` calls `isUnsafeNetworkHost()`         |
| 34  | Error message disclosure | Warning  | No `err.message` passed into an API route's JSON response                             |
| 35  | Docker COPY of secrets   | Critical | Dockerfile `COPY`/`ADD` skips `.env`, `.pem`, `.key`, `id_rsa` and `credentials.json` |
| 36  | Client env leak          | Critical | `use client` files don't read secret env vars such as `SESSION_SECRET`                |
| 37  | Adapter cookie injection | Critical | Adapters and clients reject `;`, CR and LF before interpolating a `Cookie` header     |
| 38  | Credential logging       | Critical | Adapter log calls (console or pino) never carry a credential variable                 |

Critical failures block the build. Warnings are reported but don't block.

#### Inline Suppression

Suppress individual findings with an inline comment on the flagged line, the line above, or the first two lines of a catch body:

```ts
/* security-audit-ignore: stream closed by client disconnect. Nothing to recover */
} catch { /* stream already closed */ }
```

Block comments also work: `/* security-audit-ignore: reason */`

**A reason is mandatory.** A bare `// security-audit-ignore` without a colon and explanation is itself a critical failure.

Run locally: `npx tsx scripts/security-audit.ts`

---

### Security Review Checklist

Run this checklist when adding new features, modifying API routes, or before releases.

#### Pre-Flight (run every PR)

```sh
pnpm tsc                              # Type safety
pnpm test:run                         # Full test suite, security invariants included
npx tsx scripts/security-audit.ts     # Static security audit (38 checks)
```

#### 1. Authentication & Authorization

- [ ] Every new API route calls `authenticate()` from `src/lib/api-helpers.ts` as its first operation
- [ ] No new public routes added without updating the proxy allowlist in `src/proxy.ts` (lines 12-14)
- [ ] `authenticate()` failure returns `NextResponse.json({ error }, { status: 401 })`, with no fallthrough
- [ ] Destructive operations (nuke, lockdown, restore) require additional password verification beyond the session
- [ ] TOTP-protected flows use the pending token pattern (60s JWE), not direct session issuance
- [ ] New settings or admin actions do NOT bypass the three-layer defense: proxy -> layout -> route handler

#### 2. Input Validation

- [ ] All user-supplied strings have a maximum length (`str.length > N` -> 400)
- [ ] URL inputs validated with `new URL()` + scheme restricted to `http://` or `https://`
- [ ] Color inputs validated against hex pattern (`/^#[0-9a-fA-F]{3,8}$/`)
- [ ] Numeric inputs parsed and bounds-checked (poll interval clamped to 15-1440)
- [ ] Date inputs regex-validated (`/^\d{4}-\d{2}-\d{2}$/`) or null
- [ ] ID parameters parsed as integers with `Number()` + `Number.isNaN()` check
- [ ] Platform type validated against allowlist, not open string
- [ ] No user input concatenated into SQL, since all queries use Drizzle ORM's parameterized API
- [ ] File paths from user input validated with `path.resolve()` + `startsWith(basePath + path.sep)`

#### 3. XSS Prevention

- [ ] Zero uses of unsafe HTML injection methods in source files (innerHTML assignment, etc.)
- [ ] Zero uses of code-injection-risk functions in source files
- [ ] All user data rendered through JSX interpolation (`{value}`), never as raw HTML
- [ ] ECharts tooltip `formatter` functions only render app-computed data, not raw user strings
- [ ] No script tags dynamically constructed from user input
- [ ] The static security audit (`scripts/security-audit.ts` check #2) passes

#### 4. Encryption & Secrets

- [ ] API tokens stored via `encrypt()` from `src/lib/crypto.ts`, never plaintext in the database
- [ ] `encryptedApiToken` excluded from ALL API response objects (grep for `// SECURITY` comments)
- [ ] `passwordHash` never included in API responses or backup exports
- [ ] Encrypted credentials (`encryptedUsername`, `encryptedPassword`, `encryptedProxyPassword`, `encryptedUrlPath`, `encryptedApiKey`, `encryptedConfig`) excluded from responses
- [ ] Password change route re-encrypts all secrets with the new derived key
- [ ] `SESSION_SECRET` is at least 32 characters (checked at startup)
- [ ] No secrets in `console.log`, `console.error`, or logger calls, hostnames only and never full URLs with tokens
- [ ] Error messages from adapter-fetch sanitize to hostname only (no token leakage in stack traces)

#### 5. Session Security

- [ ] Session cookie set with: `httpOnly: true`, `sameSite: "strict"`, `secure: shouldSecureCookies()`, `path: "/"`
- [ ] Session has hard expiry (7 days) encoded in the JWE payload, not just cookie `maxAge`
- [ ] Destructive operations (lockdown, nuke, password change, restore) zero-fill the encryption key buffer and stop the scheduler. Logout preserves the scheduler for 24/7 polling.
- [ ] Login returns the encryption key only inside the JWE session, never in the response body
- [ ] Failed login attempts increment atomically via `recordFailedAttempt()` in `src/lib/wipe.ts`

#### 6. External Requests

- [ ] All outbound HTTP requests have a timeout (`AbortSignal.timeout(15_000)` or equivalent)
- [ ] Tracker URLs validated at creation time, with no open redirects or protocol switching
- [ ] Proxy-required trackers (`useProxy: true`) throw if proxy is unavailable, with no fallback to a direct connection
- [ ] qBT client connections validate host/port, with no SSRF via user-configured client addresses
- [ ] No user-controlled data in `Authorization` headers beyond the stored (encrypted) API token

#### 7. Database Operations

- [ ] All queries use Drizzle ORM, never raw SQL strings with interpolated values
- [ ] BigInt values serialized as decimal strings in JSON (not `Number()` which truncates at 2^53)
- [ ] Backup restore runs inside a transaction, so partial failures roll back cleanly
- [ ] `scrubAndDeleteAll` overwrites sensitive columns with random bytes before deletion
- [ ] Failed login counter uses atomic SQL (update + returning), with no TOCTOU race

#### 8. File Operations

- [ ] File read/delete operations validate resolved path against base directory + `path.sep`
- [ ] Backup format is pure JSON, not zip or tar archives (which eliminates the zip slip surface)
- [ ] No shell commands with user-supplied arguments
- [ ] Scheduled backup filenames are server-generated (timestamp-based), not user-controlled

#### 9. Security Headers

Verify in `next.config.ts`:

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Content-Security-Policy: frame-ancestors 'none'`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `X-DNS-Prefetch-Control: off`

#### 10. Docker & Deployment

- [ ] Container runs as non-root user (UID 1001 `nextjs`)
- [ ] `NODE_ENV=production` set in Dockerfile (cookie `secure` flag derived from `BASE_URL`/`SECURE_COOKIES`, not `NODE_ENV`)
- [ ] PostgreSQL on internal network, with no published ports
- [ ] No `.env` files tracked by git (checked by security audit #7)
- [ ] `scripts/reset-password-nuclear.mjs` not included in production Docker image

#### Quick Verification Commands

```sh
# Run static security audit (covers XSS, auth, secrets, headers)
npx tsx scripts/security-audit.ts

# Verify all API routes authenticate (files missing authenticate/getSession/readSession)
grep -rL 'authenticate\|getSession\|readSession' src/app/api/**/route.ts

# Count security tests (must meet the minimum in .github/workflows/security-audit.yml)
pnpm test:run -- src/lib/__tests__/security.test.ts 2>&1 | grep 'Tests'
```

---

### Huntarr Anti-Pattern Checklist

Comparison against the 21 vulnerabilities found in Huntarr v9.4.2 ([security review](https://github.com/rfsbraz/huntarr-security-review)):

| Huntarr Vulnerability                  | Status    | Implementation                                                                       |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Unauthenticated settings write         | Mitigated | All routes call `authenticate()`                                                     |
| Setup flow re-arm without auth         | Mitigated | Setup checks for existing config, no clear/reset endpoint                            |
| TOTP enrollment without auth           | Mitigated | TOTP setup/confirm/disable all require active session via `authenticate()`           |
| Recovery key without auth              | Mitigated | Backup codes shown only during enrollment; disable requires valid code               |
| Zip Slip file write                    | Mitigated | Backups are pure JSON, not archives; no file extraction                              |
| Path traversal in backup               | Mitigated | File deletion validates resolved path against configured base directory + `path.sep` |
| Auth bypass whitelist                  | Mitigated | No whitelist, direct auth per route                                                  |
| Passwords in API responses             | Mitigated | `encryptedApiToken` explicitly excluded from all responses                           |
| SHA-256 password hashing               | Mitigated | Argon2 memory-hard KDF                                                               |
| Cleartext credential storage           | Mitigated | AES-256-GCM encrypted at rest                                                        |
| X-Forwarded-For trust                  | N/A       | No proxy bypass mode                                                                 |
| Hardcoded API keys                     | Mitigated | All secrets from env vars or encrypted user input                                    |
| XML parsing vulnerabilities            | N/A       | No XML handling                                                                      |
| Container runs as root                 | Mitigated | Dockerfile uses `USER nextjs` (UID 1001) with explicit `adduser`/`addgroup`          |
| Broad auth bypass matching             | Mitigated | Explicit route-level auth, no substring/suffix matching                              |
| Full cross-app credential exposure     | Mitigated | Responses return only safe fields, not entire config                                 |
| World-writable file permissions        | N/A       | No installation scripts or service files                                             |
| Network calls without timeouts         | Mitigated | 15-second AbortSignal on all external fetches                                        |
| Weak password hashing (salted SHA-256) | Mitigated | Argon2 with default parameters                                                       |
| No dependency scanning                 | Mitigated | Automated via `dependency-review.yml` GitHub Actions workflow on every PR            |
| No security disclosure process         | Mitigated | This document, plus issue tracker                                                    |
