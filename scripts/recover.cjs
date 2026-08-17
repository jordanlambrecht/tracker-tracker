// scripts/recover.cjs
//
// Emergency master-password recovery for a locked-out operator.
//
// ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Every secret in this database — tracker API tokens, download-client
// credentials, notification configs, the TOTP secret — is encrypted with
// scrypt(masterPassword, app_settings.encryption_salt). There is no password
// reset in the UI, and the obvious database surgery is catastrophic:
//
//     UPDATE app_settings SET password_hash = '...';   -- ✗ NEVER DO THIS
//
// That lets you log in with a key that decrypts nothing. Every secret in the
// instance is orphaned, permanently, with no error message.
//
// The recovery is possible because app_settings.encrypted_scheduler_key holds
// the current master key wrapped under a key derived from SESSION_SECRET alone
// (HKDF-SHA256, info "tracker-tracker:scheduler-key-v1") — no password
// involved. The scheduler needs it to keep polling across restarts while nobody
// is logged in, and it is also the thing that makes a lossless reset possible.
// This tool unwraps it, decrypts every stored secret with it, re-encrypts them
// under scrypt(newPassword, the SAME salt), re-hashes the password, clears the
// lockout counter, and re-wraps the new master key — all in one transaction.
//
// ─── HOW TO RUN IT ──────────────────────────────────────────────────────────
//
// Take a database dump first:
//
//     docker exec tracker-tracker-db sh -c \
//       'pg_dump -U "$POSTGRES_USER" tracker_tracker' > tracker-tracker-backup.sql
//
// Then, against a running stack from the published docker-compose.yml:
//
//     docker exec -it tracker-tracker-app tt-recover --check   # can I recover?
//     docker exec -it tracker-tracker-app tt-recover           # dry run
//     docker exec -it tracker-tracker-app tt-recover --apply   # commit
//
// `-it` is required for the hidden password prompt. `docker exec` does not run
// the entrypoint, so it also does not inherit the DATABASE_URL the entrypoint
// builds — that is rebuilt from POSTGRES_* below, exactly as src/lib/db/index.ts
// does.
//
// ─── WHY THIS FILE IS PLAIN COMMONJS ────────────────────────────────────────
//
// It has to run inside the production image, which is a Next.js *standalone*
// build. That image has no tsx, no devDependencies, and no npm/npx/corepack
// (they are deleted in Dockerfile stage 4), so a .ts entry point is not
// runnable there. /app/package.json carries no "type" field, so /app is
// CommonJS and a .cjs file is unambiguous either way.
//
// Its two external requires resolve for two DIFFERENT reasons, and both were
// verified by running this file inside a real build of the image:
//
//   argon2    is on Next's builtin server-externals list, so the file tracer
//             leaves it out of the bundle and emits /app/node_modules/argon2.
//   postgres  is bundled into the server chunks and has no /app/node_modules
//             entry at all — that is the "Cannot find module 'postgres'" that
//             broke this rescue twice. The Dockerfile copies the complete
//             package from the deps stage into /app/node_modules/postgres for
//             this script alone. Do NOT "fix" it by adding postgres to
//             serverExternalPackages; that ships an ESM-only subset with no
//             cjs/ build and no top-level entry, and require() still fails.
//             The comment in next.config.ts records the measurements.
//
// Both requires are at module scope so that `tt-recover --help` fails loudly if
// either ever stops resolving — that is what the smoke step in
// .github/workflows/docker.yml asserts on every pull request.
//
// ─── CONSOLIDATION NOTE ─────────────────────────────────────────────────────
//
// This file is the single implementation. The pure, database-free half is
// exported at the bottom and unit-tested by src/lib/__tests__/reset-password.test.ts,
// which also asserts byte-level interoperability with src/lib/crypto.ts in both
// directions. If you edit the crypto or sentinel logic here, that test is what
// catches the drift.

"use strict"

const { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scryptSync } = require("node:crypto")

// Deliberately at module scope — see "WHY THIS FILE IS PLAIN COMMONJS" above.
const argon2 = require("argon2")
const postgres = require("postgres")

// ─── crypto: a byte-for-byte mirror of src/lib/crypto.ts ────────────────────
// Duplicated rather than imported because src/ is TypeScript with "@/" path
// aliases and neither tsx nor a TS loader exists in the production image.
// src/lib/__tests__/reset-password.test.ts proves the two agree by executing
// them against each other.

const KEY_LENGTH = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/** Mirrors PASSWORD_MIN / PASSWORD_MAX in src/lib/limits.ts. */
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

/** scrypt(password, salt) — the master key. Mirrors deriveKey(). */
function deriveKey(password, salt) {
  return scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
}

/**
 * HKDF(SESSION_SECRET) — the key that wraps the master key at rest.
 * Mirrors deriveWrappingKey(). Reads the environment because that is the whole
 * point: this key exists without the password.
 */
function deriveWrappingKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters")
  }
  return Buffer.from(hkdfSync("sha256", secret, "", "tracker-tracker:scheduler-key-v1", 32))
}

/** base64(iv ‖ authTag ‖ ciphertext). Mirrors encrypt(). */
function encrypt(plaintext, key) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")
}

/**
 * Mirrors decrypt(), including its length bound.
 *
 * The floor is iv + authTag with NO trailing byte, because encrypt("") produces
 * exactly that and nothing more. Do not tighten it: a download client with
 * genuinely blank credentials (qBittorrent's "bypass authentication for
 * localhost" mode) stores encrypt("") and would be reported here as corrupt.
 */
function decrypt(encryptedBase64, key) {
  const combined = Buffer.from(encryptedBase64, "base64")
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short")
  }
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

// ─── pure recovery core ─────────────────────────────────────────────────────

/**
 * Written into trackers.encrypted_api_token by the emergency lockdown route
 * (src/app/api/settings/lockdown/route.ts) in place of a real token.
 *
 * This is the value that makes a plain `value ? decrypt(value) : ""` guard
 * insufficient: it is TRUTHY, so it sails past that check into decrypt(), where
 * it base64-decodes to 12 bytes — under the 28-byte iv+tag floor — and throws.
 * Read as a decrypt failure it looks like a corrupt row; read as a sentinel
 * (correct) it survives untouched and the operator keeps the visible evidence
 * that a lockdown happened.
 */
const LOCKDOWN_SENTINEL = "LOCKDOWN_REVOKED"

/** Thrown by recoverMasterKey() when the wrapped key is gone. See FACT 5 / --check. */
const ERR_NO_SCHEDULER_KEY = "ERR_NO_SCHEDULER_KEY"

/**
 * True when a stored value is a plaintext marker rather than AES-GCM
 * ciphertext, and therefore must never be handed to decrypt().
 *
 * Three shapes reach the database:
 *   null                 the absent marker for every nullable encrypted column
 *   ""                   the absent marker for the NOT NULL credential columns:
 *                        written by the lockdown route, by the restore route's
 *                        failure path, and by the ordinary "this client
 *                        authenticates by password, so it has no API key" path
 *   LOCKDOWN_REVOKED     see above
 *
 * Note what is deliberately NOT a sentinel: encrypt("") is a real 28-byte
 * ciphertext. It decrypts to "" but it must be re-keyed like any other value,
 * or the client that stored it fails every poll after the reset.
 */
function isPlaintextSentinel(value) {
  return value === null || value === undefined || value === "" || value === LOCKDOWN_SENTINEL
}

/**
 * Decide the fate of one encrypted column value.
 *
 *   { status: "preserved", value }  a sentinel — never decrypted, never rewritten
 *   { status: "rekeyed",  value }   real ciphertext, now sealed under newKey
 *   { status: "failed",   error }   already unreadable; the caller reports it by
 *                                   name and leaves the column out of the UPDATE
 *
 * A value that decrypts to "" is re-encrypted as encrypt("", newKey) — a real
 * ciphertext — and is deliberately NOT collapsed to a bare "". Collapsing it
 * turns a valid blank credential into a sentinel and makes the credential
 * loader throw later.
 */
function rekeyField(value, oldKey, newKey) {
  if (isPlaintextSentinel(value)) {
    return { status: "preserved", value: value === undefined ? null : value }
  }
  try {
    return { status: "rekeyed", value: encrypt(decrypt(value, oldKey), newKey) }
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Recover the master key from app_settings.encrypted_scheduler_key.
 *
 * Succeeding here is cryptographic proof that SESSION_SECRET is correct: the
 * GCM auth tag would not verify otherwise. It is NOT proof that the recovered
 * key matches the data — that requires actually decrypting a stored secret,
 * which main() does before writing anything.
 *
 * A NULL/empty wrapped value throws with code ERR_NO_SCHEDULER_KEY. Callers must
 * treat that as a full stop, never as "assume an empty key".
 */
function recoverMasterKey(wrapped, wrappingKey) {
  if (wrapped === null || wrapped === undefined || wrapped === "") {
    const err = new Error("app_settings.encrypted_scheduler_key is NULL — the master key is unrecoverable")
    err.code = ERR_NO_SCHEDULER_KEY
    throw err
  }
  const keyHex = decrypt(wrapped, wrappingKey)
  const key = Buffer.from(keyHex, "hex")
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Unwrapped scheduler key is ${key.length} bytes, expected ${KEY_LENGTH} — the stored value is corrupt`
    )
  }
  return key
}

/** Seal a master key for storage in app_settings.encrypted_scheduler_key. */
function wrapMasterKey(key, wrappingKey) {
  return encrypt(key.toString("hex"), wrappingKey)
}

/**
 * Every column encrypted under the master key.
 *
 * Verified three ways: against src/lib/db/schema.ts, against the re-encryption
 * block of src/app/api/auth/change-password/route.ts, and against the columns
 * the lockdown route clears. Missing one here means permanent data loss for that
 * column, so treat additions to the schema as additions here.
 *
 * encrypted_scheduler_key is deliberately absent: it is wrapped with the
 * SESSION_SECRET key, not the master key, so it is RE-WRAPPED, never re-keyed.
 * encryption_salt is reused verbatim and never regenerated.
 */
const MASTER_KEY_TABLES = [
  {
    table: "trackers",
    label: "name",
    // encrypted_credentials is NULLABLE — a tracker with no vault stores NULL,
    // which isPlaintextSentinel() already preserves untouched.
    columns: ["encrypted_api_token", "encrypted_credentials"],
  },
  {
    table: "download_clients",
    label: "name",
    columns: ["encrypted_username", "encrypted_password", "encrypted_api_key"],
  },
  { table: "notification_targets", label: "name", columns: ["encrypted_config"] },
]

const MASTER_KEY_SETTINGS_COLUMNS = [
  "totp_secret",
  "totp_backup_codes",
  "encrypted_proxy_password",
  "encrypted_backup_password",
  "encrypted_ptpimg_api_key",
  "encrypted_oeimg_api_key",
  "encrypted_imgbb_api_key",
]

// ─── CLI plumbing ───────────────────────────────────────────────────────────

const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_UNRECOVERABLE = 2
const EXIT_KEY_MISMATCH = 3
const EXIT_NO_TTY = 4

const out = (s) => process.stdout.write(s)
const err = (s) => process.stderr.write(s)

const HELP = `tt-recover — emergency master-password recovery for tracker-tracker

  Resets the master password AND re-encrypts every secret in the database so
  nothing is orphaned. Requires SESSION_SECRET (already set in the container)
  and an intact app_settings.encrypted_scheduler_key.

USAGE
  docker exec -it tracker-tracker-app tt-recover [flags]

FLAGS
  --check           Report only: is recovery possible, and what would be
                    re-keyed. Asks for no password and writes nothing.
  --apply           Commit the reset. Without it this is a DRY RUN.
  --password <pw>   Supply the new password non-interactively. Prefer the
                    prompt: an argv password is visible in shell history, in
                    'ps', and in /proc/<pid>/cmdline to anything else in the
                    container.
  --disable-totp    Also clear the TOTP secret and backup codes, so a lost
                    authenticator does not lock you out again after the reset.
  --help, -h        This text.

ENVIRONMENT
  SESSION_SECRET                       required, min 32 characters
  DATABASE_URL                         or, for the bundled database:
  POSTGRES_HOST / _USER / _PASSWORD / _PORT / _DB

TAKE A DUMP FIRST
  docker exec tracker-tracker-db sh -c \\
    'pg_dump -U "$POSTGRES_USER" tracker_tracker' > tracker-tracker-backup.sql
`

function parseArgs(argv) {
  const args = {
    apply: false,
    check: false,
    disableTotp: false,
    help: false,
    password: null,
    unknown: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--apply") args.apply = true
    else if (a === "--check") args.check = true
    else if (a === "--disable-totp") args.disableTotp = true
    else if (a === "--help" || a === "-h") args.help = true
    else if (a === "--password") args.password = argv[++i] ?? null
    else args.unknown.push(a)
  }
  return args
}

/**
 * Rebuild the connection string from POSTGRES_*.
 *
 * This mirrors buildConnectionString() in src/lib/db/index.ts and it is not
 * optional: DATABASE_URL is constructed and exported only inside
 * docker-entrypoint.sh, in the server's own process tree. A `docker exec`
 * process gets the container's configured environment, which for the bundled
 * compose file means POSTGRES_* and no DATABASE_URL at all.
 */
function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const password = process.env.POSTGRES_PASSWORD
  if (!password) {
    throw new Error(
      "Neither DATABASE_URL nor POSTGRES_PASSWORD is set, so there is no way to reach the database.\n" +
        "  Inside the app container both normally come from your compose file."
    )
  }
  const user = process.env.POSTGRES_USER ?? "postgres"
  const host = process.env.POSTGRES_HOST ?? "localhost"
  const port = process.env.POSTGRES_PORT ?? "5432"
  const name = process.env.POSTGRES_DB ?? "tracker_tracker"
  if (!process.env.POSTGRES_HOST) {
    err(
      "WARNING: POSTGRES_HOST is not set, falling back to 'localhost'. In the bundled\n" +
        "         compose stack the database is a separate container (tracker-tracker-db),\n" +
        "         so a connection refused here means that variable is missing.\n\n"
    )
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`
}

/**
 * Read a line from a TTY without echoing it.
 *
 * Raw mode plus public stream API only — no prompt library is resolvable inside
 * the standalone image, and readline's `_writeToOutput` echo suppression is a
 * private field this should not depend on during an emergency.
 *
 * `input` and `write` are parameters rather than hardcoded process handles so
 * the keystroke handling below is unit-testable without a terminal; promptHidden()
 * supplies the real ones. Note what `write` never receives: the typed characters.
 */
function readHiddenLine(question, input, write) {
  // Control bytes, built with fromCharCode so no literal control character ever
  // lands in this file: ESC starts an arrow-key sequence, EOT is ctrl-D, ETX is
  // ctrl-C, DEL is the backspace most terminals actually send.
  const ESC = String.fromCharCode(27)
  const EOT = String.fromCharCode(4)
  const ETX = String.fromCharCode(3)
  const DEL = String.fromCharCode(127)

  return new Promise((resolve, reject) => {
    let value = ""
    write(question)
    input.setRawMode(true)
    input.resume()
    input.setEncoding("utf8")

    const cleanup = () => {
      input.removeListener("data", onData)
      input.setRawMode(false)
      input.pause()
    }

    const onData = (chunk) => {
      // Arrow keys and friends arrive as escape sequences; swallow them whole
      // rather than inserting "[A" into the password.
      if (chunk.startsWith(ESC)) return
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === EOT) {
          cleanup()
          write("\n")
          resolve(value)
          return
        }
        if (ch === ETX) {
          cleanup()
          write("\n")
          reject(new Error("Cancelled"))
          return
        }
        if (ch === DEL || ch === "\b") {
          value = value.slice(0, -1)
          continue
        }
        if (ch >= " ") value += ch
      }
    }

    input.on("data", onData)
  })
}

/** readHiddenLine() bound to the real terminal. */
function promptHidden(question) {
  return readHiddenLine(question, process.stdin, out)
}

/** Obtain the new password, preferring the hidden prompt over argv. */
async function getNewPassword(args) {
  if (args.password !== null) {
    err(
      "NOTE: --password was read from the command line. It is visible in shell\n" +
        "      history and in the process list. Prefer the interactive prompt.\n\n"
    )
    return args.password
  }

  if (!process.stdin.isTTY) {
    err(
      "No TTY, so the password cannot be prompted for without echoing it.\n" +
        "  Re-run with -it:   docker exec -it tracker-tracker-app tt-recover --apply\n" +
        "  Or pass --password '<new password>' (visible in shell history and 'ps').\n"
    )
    process.exit(EXIT_NO_TTY)
  }

  for (;;) {
    const first = await promptHidden("New master password: ")
    if (first.length < PASSWORD_MIN || first.length > PASSWORD_MAX) {
      err(`  Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters. Try again.\n`)
      continue
    }
    const second = await promptHidden("Confirm new password: ")
    if (first !== second) {
      err("  Passwords did not match. Try again.\n")
      continue
    }
    out("\n")
    return first
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    out(HELP)
    return EXIT_OK
  }
  if (args.unknown.length > 0) {
    err(`Unrecognised argument(s): ${args.unknown.join(" ")}\n\n${HELP}`)
    return EXIT_USAGE
  }

  // SESSION_SECRET first: without it nothing below is possible, and the message
  // should not be buried under a connection error.
  let wrappingKey
  try {
    wrappingKey = deriveWrappingKey()
  } catch {
    err(
      "ABORT: SESSION_SECRET is unset or shorter than 32 characters.\n\n" +
        "  It is the only thing that can unwrap the master key, so recovery cannot\n" +
        "  even begin without it. Inside the app container it comes from your\n" +
        "  compose file. It must be byte-identical to the value the instance has\n" +
        "  been running with — if it was rotated, the wrapped key is already lost.\n\n" +
        "  Nothing was changed.\n"
    )
    return EXIT_UNRECOVERABLE
  }

  const mode = args.check ? "CHECK" : args.apply ? "APPLY" : "DRY RUN"
  out(`\n=== tracker-tracker master password recovery (${mode}) ===\n\n`)

  const sql = postgres(buildConnectionString(), {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  })

  try {
    const [settings] = await sql`SELECT * FROM app_settings LIMIT 1`
    if (!settings) {
      err(
        "ABORT: there is no app_settings row, so this instance was never set up.\n" +
          "  Open the app and complete first-run setup instead; there is no password\n" +
          "  to recover. Nothing was changed.\n"
      )
      return EXIT_UNRECOVERABLE
    }

    // 1. Recover the master key. Succeeding proves SESSION_SECRET is right.
    let oldKey
    try {
      oldKey = recoverMasterKey(settings.encrypted_scheduler_key, wrappingKey)
    } catch (e) {
      if (e.code === ERR_NO_SCHEDULER_KEY) {
        err(
          "ABORT: app_settings.encrypted_scheduler_key is NULL.\n\n" +
            "  That column held the master key, wrapped under SESSION_SECRET. It is the\n" +
            "  only copy of the key that is not derived from your password, so with it\n" +
            "  gone there is NO password-less recovery. Every stored secret can only be\n" +
            "  decrypted by someone who knows the current master password.\n\n" +
            "  It gets cleared by: emergency lockdown (which also rotates\n" +
            "  encryption_salt), a nuke, or a restore that could not re-wrap it.\n\n" +
            "  Resetting the password now would let you log in but would orphan every\n" +
            "  tracker token and client credential in the database, silently and\n" +
            "  permanently. This tool will not do that.\n\n" +
            "  What is left: keep trying the real password, restore a pg_dump from\n" +
            "  before the key was cleared, or start fresh and re-enter your secrets.\n\n" +
            "  Nothing was changed.\n"
        )
        return EXIT_UNRECOVERABLE
      }
      err(
        `ABORT: the stored scheduler key would not unwrap: ${e.message}\n\n` +
          "  The wrapping key comes from SESSION_SECRET alone, so this almost always\n" +
          "  means SESSION_SECRET is not the value this instance was running with.\n" +
          "  Check your compose file and any .env it reads. Nothing was changed.\n"
      )
      return EXIT_UNRECOVERABLE
    }
    out("[ok] Recovered the master key from encrypted_scheduler_key (SESSION_SECRET verified).\n")

    // 2. Prove the key against real data BEFORE asking for a password or writing
    //    anything. Unwrapping proves SESSION_SECRET; only this proves the key
    //    still matches the ciphertext in the database.
    const rows = new Map()
    let candidates = 0
    let proven = 0
    let preserved = 0
    const failures = []
    const readable = new Set()

    for (const spec of MASTER_KEY_TABLES) {
      const tableRows = await sql`SELECT * FROM ${sql(spec.table)}`
      rows.set(spec.table, tableRows)
      for (const row of tableRows) {
        for (const col of spec.columns) {
          const raw = row[col]
          if (isPlaintextSentinel(raw)) {
            preserved++
            continue
          }
          candidates++
          try {
            decrypt(raw, oldKey)
            proven++
            readable.add(`${spec.table}:${row.id}:${col}`)
          } catch (e) {
            failures.push(`${spec.table} #${row.id} (${row[spec.label] ?? "unnamed"}) .${col}: ${e.message}`)
          }
        }
      }
    }

    for (const col of MASTER_KEY_SETTINGS_COLUMNS) {
      const raw = settings[col]
      if (isPlaintextSentinel(raw)) {
        preserved++
        continue
      }
      candidates++
      try {
        decrypt(raw, oldKey)
        proven++
        readable.add(`app_settings::${col}`)
      } catch (e) {
        failures.push(`app_settings.${col}: ${e.message}`)
      }
    }

    if (candidates > 0 && proven === 0) {
      err(
        `\nABORT: the recovered key did not decrypt a single one of the ${candidates} stored secret(s).\n\n` +
          "  The key unwrapped cleanly, so SESSION_SECRET is correct — but the key it\n" +
          "  yields does not match the data. That happens when the wrapped key is stale\n" +
          "  relative to the ciphertext (an interrupted password change, or a restore\n" +
          "  that mixed a dump with a different instance's settings row).\n\n" +
          "  Re-keying from a key that decrypts nothing would destroy every secret.\n" +
          "  Nothing was changed.\n"
      )
      return EXIT_KEY_MISMATCH
    }

    if (candidates === 0) {
      out(
        "[ok] No stored secrets found to verify against — this instance has no trackers,\n" +
          "     clients or notification targets configured yet. Nothing can be orphaned,\n" +
          "     so the reset is safe to proceed.\n"
      )
    } else {
      out(`[ok] Proved the key against real data: ${proven} of ${candidates} stored secret(s) decrypted.\n`)
    }
    out(`[ok] ${preserved} empty/sentinel value(s) will be preserved byte-identically.\n`)

    if (failures.length > 0) {
      out(`\n[!!] ${failures.length} value(s) could NOT be decrypted. They are already\n`)
      out("     unreadable and will be LEFT EXACTLY AS THEY ARE — not cleared, not\n")
      out("     re-keyed. Re-enter them in the app after you log back in:\n")
      for (const f of failures) out(`       - ${f}\n`)
    }

    if (settings.totp_secret && !args.disableTotp) {
      out(
        "\n[!!] TOTP is enabled on this instance. The reset re-keys the secret and\n" +
          "     leaves 2FA ON, so you will still need your authenticator to log in.\n" +
          "     If you have lost it too, re-run with --disable-totp.\n"
      )
    }

    // A username is a second credential the login form demands, and this tool
    // does not reset it. Resetting the password while the username is forgotten
    // leaves the operator locked out just as hard, so say what it is here —
    // nothing else in the image will tell them.
    if (settings.username) {
      out(
        `\n[!!] This instance also requires a USERNAME to log in: "${settings.username}"\n` +
          "     The reset does not change it. You will need both.\n"
      )
    } else {
      out("\n[ok] No username is set — log in with the password alone.\n")
    }

    if (args.check) {
      out(
        "\nCHECK ONLY — nothing was read into a password prompt and nothing was written.\n" +
          "Recovery IS possible. Re-run without --check for a dry run.\n\n"
      )
      return EXIT_OK
    }

    // 3. Now, and only now, ask for the new password.
    const newPassword = await getNewPassword(args)
    if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
      err(`\nABORT: password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters. Nothing was changed.\n`)
      return EXIT_USAGE
    }

    // encryption_salt is REUSED, never regenerated — regenerating it would make
    // the old ciphertext unreachable from any password at all.
    const newKey = deriveKey(newPassword, settings.encryption_salt)

    // 4. Build the whole write plan in memory. Plaintext exists only inside
    //    rekeyField() and is never collected, logged or printed.
    const updates = []
    let rekeyed = 0
    for (const spec of MASTER_KEY_TABLES) {
      for (const row of rows.get(spec.table)) {
        const set = {}
        for (const col of spec.columns) {
          // Sentinels and unreadable values are omitted from the UPDATE entirely.
          // Untouched is the most byte-identical outcome available.
          if (!readable.has(`${spec.table}:${row.id}:${col}`)) continue
          const outcome = rekeyField(row[col], oldKey, newKey)
          if (outcome.status !== "rekeyed") continue
          set[col] = outcome.value
          rekeyed++
        }
        if (Object.keys(set).length > 0) updates.push({ table: spec.table, id: row.id, set })
      }
    }

    const settingsSet = {}
    for (const col of MASTER_KEY_SETTINGS_COLUMNS) {
      if (!readable.has(`app_settings::${col}`)) continue
      const outcome = rekeyField(settings[col], oldKey, newKey)
      if (outcome.status !== "rekeyed") continue
      settingsSet[col] = outcome.value
      rekeyed++
    }

    out(
      `\n[ok] Re-key plan: ${rekeyed} secret(s) across ${updates.length} row(s)` +
        ` and ${Object.keys(settingsSet).length} app_settings column(s).\n`
    )
    out("[ok] encrypted_scheduler_key will be re-wrapped around the NEW master key.\n")
    out("[ok] failed_login_attempts and locked_until will be cleared.\n")
    if (args.disableTotp) out("[ok] TOTP secret and backup codes will be cleared.\n")

    if (!args.apply) {
      out(
        "\nDRY RUN — nothing was written.\n\n" +
          "  Take a dump first if you have not:\n" +
          "    docker exec tracker-tracker-db sh -c 'pg_dump -U \"$POSTGRES_USER\" tracker_tracker' > backup.sql\n\n" +
          "  Then commit:\n" +
          "    docker exec -it tracker-tracker-app tt-recover --apply\n\n"
      )
      return EXIT_OK
    }

    // 5. One transaction. Either the password and every secret move together, or
    //    nothing moves. A partial write here is the orphaning scenario.
    const newHash = await argon2.hash(newPassword)
    const rewrapped = wrapMasterKey(newKey, wrappingKey)

    await sql.begin(async (tx) => {
      for (const u of updates) {
        await tx`UPDATE ${tx(u.table)} SET ${tx(u.set, Object.keys(u.set))} WHERE id = ${u.id}`
      }

      const finalSet = { ...settingsSet }
      finalSet.password_hash = newHash
      finalSet.failed_login_attempts = 0
      finalSet.locked_until = null
      finalSet.encrypted_scheduler_key = rewrapped
      if (args.disableTotp) {
        finalSet.totp_secret = null
        finalSet.totp_backup_codes = null
      }

      await tx`UPDATE app_settings SET ${tx(finalSet, Object.keys(finalSet))} WHERE id = ${settings.id}`
    })

    out(
      "\n[ok] COMMITTED.\n\n" +
        "  The master password is reset and every readable secret is re-encrypted\n" +
        "  under it. The lockout counter is cleared, so you can log in immediately.\n" +
        (args.disableTotp ? "  TOTP is disabled — set it up again from Settings.\n" : "") +
        "\n  Restart the app so the scheduler reloads the re-wrapped key:\n" +
        "    docker compose restart tracker-tracker-app\n" +
        // Sessions are stateless JWEs carrying the OLD master key, and they are
        // sealed with SESSION_SECRET, which this reset deliberately leaves alone.
        // A restart does not invalidate them and proxy.ts refreshes them on every
        // request, so an already-signed-in browser keeps decrypting with a key
        // that no longer exists anywhere. Anything it writes afterwards is
        // encrypted under that dead key and is unrecoverable — the exact failure
        // this tool exists to prevent. Nothing can revoke a stateless token from
        // here, so the warning IS the mitigation.
        "\n[!!] SIGN OUT EVERYWHERE ELSE BEFORE ENTERING ANY NEW SECRETS.\n" +
        "     Sessions opened before this reset still carry the OLD key and are\n" +
        "     not invalidated by the restart. A tracker token or password saved\n" +
        "     from one of them is encrypted under a key that no longer exists and\n" +
        "     cannot be recovered. Clear the tt_session cookie on every other\n" +
        "     device, or just sign out of each one, then log back in.\n\n"
    )
    return EXIT_OK
  } finally {
    await sql.end({ timeout: 5 })
  }
}

// Exported for src/lib/__tests__/reset-password.test.ts. Everything here is
// pure: no environment reads except deriveWrappingKey(), no database.
module.exports = {
  ERR_NO_SCHEDULER_KEY,
  LOCKDOWN_SENTINEL,
  MASTER_KEY_SETTINGS_COLUMNS,
  MASTER_KEY_TABLES,
  PASSWORD_MAX,
  PASSWORD_MIN,
  buildConnectionString,
  decrypt,
  deriveKey,
  deriveWrappingKey,
  encrypt,
  isPlaintextSentinel,
  parseArgs,
  readHiddenLine,
  recoverMasterKey,
  rekeyField,
  wrapMasterKey,
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((e) => {
      err(`\nFAILED: ${e?.message ? e.message : String(e)}\n`)
      if (e?.stack) err(`${e.stack}\n`)
      err("\nNothing was committed unless a '[ok] COMMITTED' line appeared above.\n")
      process.exit(EXIT_USAGE)
    })
}
