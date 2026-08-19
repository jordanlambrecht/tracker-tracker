// src/lib/__tests__/reset-password.test.ts
//
// Covers the pure logic behind the emergency recovery CLI, scripts/recover.cjs.
//
// It loads the SHIPPED ARTIFACT rather than a TypeScript copy of it. There used
// to be three overlapping implementations of this operation and the one that had
// tests was not the one that could run in the production image. Testing the .cjs
// directly is what keeps those from diverging again, including the parity block
// below, which executes the CLI's crypto against src/lib/crypto.ts in both
// directions. That cross-check was done by hand during a real lockout; here it
// runs on every commit.
//
// createRequire is used instead of a bare import so Node loads the CommonJS file
// as-is, with no bundler transform between the test and the file that ships.

import { randomBytes } from "node:crypto"
import { createRequire } from "node:module"
import { getTableColumns, getTableName, is } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { decrypt, deriveKey, deriveWrappingKey, encrypt } from "@/lib/crypto"
import * as schema from "@/lib/db/schema"
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/limits"

const require = createRequire(import.meta.url)
const recover = require("../../../scripts/recover.cjs")

const {
  ERR_NO_SCHEDULER_KEY,
  LOCKDOWN_SENTINEL,
  MASTER_KEY_SETTINGS_COLUMNS,
  MASTER_KEY_TABLES,
  buildConnectionString,
  isPlaintextSentinel,
  parseArgs,
  recoverMasterKey,
  rekeyField,
  wrapMasterKey,
} = recover

const keyA = randomBytes(32)
const keyB = randomBytes(32)

describe("parity with src/lib/crypto.ts", () => {
  // The CLI cannot import src/lib/crypto.ts. The production image has no tsx and
  // cannot resolve "@/" — so the primitives are duplicated there. These four
  // assertions are the only thing standing between that duplication and a reset
  // that produces ciphertext the running app cannot open.

  it("decrypts, in the CLI, what the app encrypted", () => {
    const secret = "tracker-api-token-12345"

    expect(recover.decrypt(encrypt(secret, keyA), keyA)).toBe(secret)
  })

  it("decrypts, in the app, what the CLI encrypted", () => {
    const secret = "tracker-api-token-12345"

    expect(decrypt(recover.encrypt(secret, keyA), keyA)).toBe(secret)
  })

  it("derives the same master key from a password and salt", async () => {
    const salt = randomBytes(32).toString("hex")

    const appKey = await deriveKey("correct horse battery staple", salt)
    const cliKey = recover.deriveKey("correct horse battery staple", salt)

    expect(cliKey.equals(appKey)).toBe(true)
  })

  it("derives the same SESSION_SECRET wrapping key", () => {
    const previous = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = "a".repeat(48)
    try {
      expect(recover.deriveWrappingKey().equals(deriveWrappingKey())).toBe(true)
    } finally {
      process.env.SESSION_SECRET = previous
    }
  })

  it("agrees with the app on the password length bounds", () => {
    // The CLI hardcodes these because it cannot import @/lib/limits.
    expect(recover.PASSWORD_MIN).toBe(PASSWORD_MIN)
    expect(recover.PASSWORD_MAX).toBe(PASSWORD_MAX)
  })
})

describe("master key recovery from the wrapped scheduler key", () => {
  it("round-trips a master key through wrap/unwrap", () => {
    const masterKey = randomBytes(32)
    const wrappingKey = randomBytes(32)

    const recovered = recoverMasterKey(wrapMasterKey(masterKey, wrappingKey), wrappingKey)

    expect(recovered.equals(masterKey)).toBe(true)
  })

  it("stores the key as hex ciphertext, not the raw key", () => {
    const masterKey = randomBytes(32)
    const wrappingKey = randomBytes(32)

    const wrapped = wrapMasterKey(masterKey, wrappingKey)

    expect(wrapped).not.toContain(masterKey.toString("hex"))
    expect(decrypt(wrapped, wrappingKey)).toBe(masterKey.toString("hex"))
  })

  it("recovers the key that the app itself stored, via SESSION_SECRET alone", () => {
    // The whole premise of the tool: the wrapping key comes from SESSION_SECRET
    // with no password involved.
    const previous = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = "a".repeat(48)
    try {
      const masterKey = randomBytes(32)
      // Exactly what persistSchedulerKey() writes.
      const stored = encrypt(masterKey.toString("hex"), deriveWrappingKey())

      const recovered = recoverMasterKey(stored, recover.deriveWrappingKey())

      expect(recovered.equals(masterKey)).toBe(true)
    } finally {
      process.env.SESSION_SECRET = previous
    }
  })

  it("throws rather than returning a wrong-length key when the wrapping key is wrong", () => {
    const wrapped = wrapMasterKey(randomBytes(32), keyA)

    expect(() => recoverMasterKey(wrapped, keyB)).toThrow()
  })

  it("rejects a value that decrypts but is not a 32-byte key", () => {
    // A stale or truncated stored value must abort, never silently produce a
    // short key that would then re-encrypt everything unrecoverably.
    const wrapped = encrypt("deadbeef", keyA)

    expect(() => recoverMasterKey(wrapped, keyA)).toThrow(/expected 32/)
  })
})

describe("abort when the wrapped key is gone", () => {
  // FACT 5: emergency lockdown clears encrypted_scheduler_key AND rotates
  // encryption_salt. Past that point no password-less recovery exists, and a
  // tool that plows ahead orphans every secret in the database.

  it("throws a distinguishable error for a NULL scheduler key", () => {
    expect(() => recoverMasterKey(null, keyA)).toThrow(/unrecoverable/)
  })

  it("tags the NULL case with a code so the CLI can explain it specifically", () => {
    // main() branches on this code to print the FACT 5 explanation rather than a
    // generic crypto failure.
    expect.assertions(2)
    try {
      recoverMasterKey(null, keyA)
    } catch (e) {
      expect((e as { code?: string }).code).toBe(ERR_NO_SCHEDULER_KEY)
      expect(ERR_NO_SCHEDULER_KEY).toBe("ERR_NO_SCHEDULER_KEY")
    }
  })

  it("treats undefined and empty string the same as NULL", () => {
    // A missing column reads as undefined; a blanked one as "". Neither is a key.
    expect(() => recoverMasterKey(undefined, keyA)).toThrow()
    expect(() => recoverMasterKey("", keyA)).toThrow()
    expect(() => recoverMasterKey(undefined, keyA)).toThrow(/unrecoverable/)
    expect(() => recoverMasterKey("", keyA)).toThrow(/unrecoverable/)
  })

  it("never returns a key of any kind for the NULL case", () => {
    // The catastrophic bug would be returning an empty Buffer and re-keying
    // every secret under it.
    let returned: unknown = "not thrown"
    try {
      returned = recoverMasterKey(null, keyA)
    } catch {
      returned = undefined
    }
    expect(returned).toBeUndefined()
  })
})

describe("plaintext sentinels", () => {
  it("recognises every absent-value marker that reaches the database", () => {
    expect(isPlaintextSentinel(null)).toBe(true)
    expect(isPlaintextSentinel(undefined)).toBe(true)
    expect(isPlaintextSentinel("")).toBe(true)
    expect(isPlaintextSentinel(LOCKDOWN_SENTINEL)).toBe(true)
  })

  it("uses the exact string the lockdown route writes", () => {
    // src/app/api/settings/lockdown/route.ts writes this literal into
    // trackers.encrypted_api_token.
    expect(LOCKDOWN_SENTINEL).toBe("LOCKDOWN_REVOKED")
  })

  it("does not treat real ciphertext as a sentinel", () => {
    expect(isPlaintextSentinel(encrypt("token", keyA))).toBe(false)
  })

  it("does not treat an encrypted empty string as a sentinel", () => {
    // encrypt("") is a real 28-byte ciphertext (iv + auth tag, no body) and must
    // be re-keyed like any other value.
    const blank = encrypt("", keyA)

    expect(Buffer.from(blank, "base64")).toHaveLength(28)
    expect(isPlaintextSentinel(blank)).toBe(false)
  })

  it("passes an empty string through untouched instead of decrypting it", () => {
    expect(rekeyField("", keyA, keyB)).toEqual({ status: "preserved", value: "" })
  })

  it("passes null through untouched", () => {
    expect(rekeyField(null, keyA, keyB)).toEqual({ status: "preserved", value: null })
  })

  it("passes LOCKDOWN_REVOKED through byte-identically", () => {
    // The dangerous one: it is truthy, so a `value ? decrypt(value) : ""` guard
    // hands it to decrypt(), where it fails the length check and is misread as
    // corruption. Normalising it to "" would erase a deliberate revocation
    // marker and the evidence that a lockdown happened.
    expect(Buffer.from(LOCKDOWN_SENTINEL, "base64").length).toBeLessThan(28)

    const outcome = rekeyField(LOCKDOWN_SENTINEL, keyA, keyB)

    expect(outcome).toEqual({ status: "preserved", value: LOCKDOWN_SENTINEL })
    expect(outcome.value).toBe(LOCKDOWN_SENTINEL)
  })

  it("survives repeated passes without eroding the sentinel", () => {
    // A second reset must find the marker exactly as the first one left it.
    let value = LOCKDOWN_SENTINEL
    for (let i = 0; i < 3; i++) {
      const outcome = rekeyField(value, keyA, keyB)
      expect(outcome.status).toBe("preserved")
      value = outcome.value
    }
    expect(value).toBe("LOCKDOWN_REVOKED")
  })
})

describe("re-encryption transform", () => {
  it("re-keys so the value opens with the new key and no longer with the old", () => {
    const secret = "tracker-api-token-12345"
    const stored = encrypt(secret, keyA)

    const outcome = rekeyField(stored, keyA, keyB)

    expect(outcome.status).toBe("rekeyed")
    expect(decrypt(outcome.value, keyB)).toBe(secret)
    expect(() => decrypt(outcome.value, keyA)).toThrow()
  })

  it("produces output the running app can read, not just the CLI", () => {
    // The reset is worthless if only the tool that wrote it can open the result.
    const secret = JSON.stringify({ url: "https://example.test/hook" })

    const outcome = rekeyField(encrypt(secret, keyA), keyA, keyB)

    expect(decrypt(outcome.value, keyB)).toBe(secret)
  })

  it("produces a different ciphertext than it consumed", () => {
    const stored = encrypt("secret", keyA)

    expect(rekeyField(stored, keyA, keyB).value).not.toBe(stored)
  })

  it("re-encrypts a genuinely blank credential as real ciphertext, not a bare empty string", () => {
    // A qBittorrent client with localhost auth bypass stores encrypt(""). If the
    // reset collapsed it to "", the credential loader would later throw.
    const outcome = rekeyField(encrypt("", keyA), keyA, keyB)

    expect(outcome.status).toBe("rekeyed")
    expect(outcome.value).not.toBe("")
    expect(decrypt(outcome.value, keyB)).toBe("")
  })

  it("survives a round trip back to the original key", () => {
    const secret = "round-trip"

    const first = rekeyField(encrypt(secret, keyA), keyA, keyB)
    const second = rekeyField(first.value, keyB, keyA)

    expect(second.status).toBe("rekeyed")
    expect(decrypt(second.value, keyA)).toBe(secret)
  })

  it("preserves unicode payloads byte-for-byte", () => {
    const secret = JSON.stringify({ webhook: "https://example.test/hook", note: "café — 日本語" })

    const outcome = rekeyField(encrypt(secret, keyA), keyA, keyB)

    expect(decrypt(outcome.value, keyB)).toBe(secret)
  })

  it("re-keys under a key derived from a real password and the REUSED salt", () => {
    // encryption_salt is never regenerated by the reset: a new salt would put the
    // old ciphertext out of reach of every possible password.
    const salt = randomBytes(32).toString("hex")
    const oldKey = recover.deriveKey("the old password", salt)
    const newKey = recover.deriveKey("the new password", salt)
    const secret = "api-token"

    const outcome = rekeyField(encrypt(secret, oldKey), oldKey, newKey)

    expect(decrypt(outcome.value, newKey)).toBe(secret)
    expect(() => decrypt(outcome.value, oldKey)).toThrow()
  })
})

describe("unrecoverable values", () => {
  it("reports a failure instead of throwing when the key is wrong", () => {
    const outcome = rekeyField(encrypt("secret", keyA), keyB, keyA)

    expect(outcome.status).toBe("failed")
    expect(outcome.error).toBeTruthy()
  })

  it("reports a failure for a tampered auth tag rather than returning plaintext", () => {
    const raw = Buffer.from(encrypt("secret", keyA), "base64")
    raw[13] ^= 0xff // flip a bit inside the auth tag
    const tampered = raw.toString("base64")

    expect(rekeyField(tampered, keyA, keyB).status).toBe("failed")
  })

  it("reports a failure for a truthy non-ciphertext value that is not a known sentinel", () => {
    expect(rekeyField("not-base64-ciphertext", keyA, keyB).status).toBe("failed")
  })

  it("never returns a usable value for a failure", () => {
    // The CLI omits failed columns from the UPDATE entirely; a `value` here would
    // let a caller write garbage over data that is merely unreadable, not lost.
    expect(rekeyField(encrypt("secret", keyA), keyB, keyA)).not.toHaveProperty("value")
  })
})

describe("column coverage", () => {
  // Missing a single master-key-encrypted column means that column stays sealed
  // under a key nobody holds after the reset — permanent, silent data loss. This
  // walks the real Drizzle schema so a newly added encrypted column fails here
  // instead of failing during someone's emergency.

  const declared = new Set<string>()
  for (const spec of MASTER_KEY_TABLES as Array<{ table: string; columns: string[] }>) {
    for (const col of spec.columns) declared.add(`${spec.table}.${col}`)
  }
  for (const col of MASTER_KEY_SETTINGS_COLUMNS as string[]) declared.add(`app_settings.${col}`)

  // Wrapped with the SESSION_SECRET-derived key, not the master key. It is
  // re-wrapped by the CLI, never re-keyed, so it must NOT be in the list above.
  const wrappedNotRekeyed = "app_settings.encrypted_scheduler_key"

  function encryptedColumnsInSchema(): string[] {
    const found: string[] = []
    for (const value of Object.values(schema)) {
      if (!is(value, PgTable)) continue
      const table = getTableName(value)
      for (const column of Object.values(getTableColumns(value))) {
        if (column.dataType !== "string") continue
        if (!/^(encrypted_|totp_)/.test(column.name)) continue
        found.push(`${table}.${column.name}`)
      }
    }
    return found.sort()
  }

  it("finds the encrypted columns it is supposed to be checking", () => {
    // Guards the guard: if the schema walk silently found nothing, every
    // assertion below would pass vacuously.
    expect(encryptedColumnsInSchema().length).toBeGreaterThan(10)
  })

  it("covers every master-key-encrypted column in the schema", () => {
    const missing = encryptedColumnsInSchema().filter(
      (c) => c !== wrappedNotRekeyed && !declared.has(c)
    )

    expect(missing).toEqual([])
  })

  it("declares no column that does not exist in the schema", () => {
    const inSchema = new Set(encryptedColumnsInSchema())

    expect([...declared].filter((c) => !inSchema.has(c))).toEqual([])
  })

  it("does not re-key the scheduler key, which is wrapped under SESSION_SECRET", () => {
    expect(declared.has(wrappedNotRekeyed)).toBe(false)
    expect(MASTER_KEY_SETTINGS_COLUMNS).not.toContain("encrypted_scheduler_key")
  })

  it("does not touch encryption_salt", () => {
    // Reusing the salt verbatim is what lets the new password reach the old data.
    expect([...declared].some((c) => c.endsWith("encryption_salt"))).toBe(false)
  })
})

describe("argument parsing", () => {
  it("defaults to a dry run", () => {
    const args = parseArgs([])

    expect(args.apply).toBe(false)
    expect(args.check).toBe(false)
    expect(args.password).toBeNull()
  })

  it("requires an explicit flag to commit", () => {
    expect(parseArgs(["--apply"]).apply).toBe(true)
  })

  it("collects unrecognised arguments instead of ignoring them", () => {
    // A typo'd flag must not silently downgrade --apply into a dry run, nor a
    // dry run into a commit.
    expect(parseArgs(["--aply"]).unknown).toEqual(["--aply"])
    expect(parseArgs(["--aply"]).apply).toBe(false)
  })

  it("does not mistake a password for a flag", () => {
    const args = parseArgs(["--password", "--apply"])

    expect(args.password).toBe("--apply")
    expect(args.apply).toBe(false)
  })

  it("parses the recovery-specific flags", () => {
    const args = parseArgs(["--check", "--disable-totp"])

    expect(args.check).toBe(true)
    expect(args.disableTotp).toBe(true)
  })
})

describe("hidden password entry", () => {
  // The prompt is the only interface a locked-out operator should be using, and
  // it cannot be exercised by running the CLI here — there is no terminal. So
  // readHiddenLine() takes its stream as a parameter and gets driven directly.

  const ESC = String.fromCharCode(27)
  const EOT = String.fromCharCode(4)
  const ETX = String.fromCharCode(3)
  const DEL = String.fromCharCode(127)

  /** Minimal stand-in for a raw-mode TTY. */
  function fakeTty() {
    const listeners: Array<(chunk: string) => void> = []
    let rawMode = false
    return {
      rawModeHistory: [] as boolean[],
      setRawMode(on: boolean) {
        rawMode = on
        this.rawModeHistory.push(on)
      },
      get rawMode() {
        return rawMode
      },
      resume() {},
      pause() {},
      setEncoding() {},
      on(_event: string, fn: (chunk: string) => void) {
        listeners.push(fn)
      },
      removeListener(_event: string, fn: (chunk: string) => void) {
        const i = listeners.indexOf(fn)
        if (i >= 0) listeners.splice(i, 1)
      },
      type(chunk: string) {
        for (const fn of [...listeners]) fn(chunk)
      },
      get listenerCount() {
        return listeners.length
      },
    }
  }

  function drive(keystrokes: string[]) {
    const tty = fakeTty()
    const written: string[] = []
    const promise = recover.readHiddenLine("Password: ", tty, (s: string) => written.push(s))
    for (const k of keystrokes) tty.type(k)
    return { promise, written, tty }
  }

  it("returns what was typed, terminated by Enter", async () => {
    const { promise } = drive(["h", "u", "n", "t", "e", "r", "2", "\r"])

    await expect(promise).resolves.toBe("hunter2")
  })

  it("never echoes the password to the output stream", async () => {
    // The entire point of raw mode here. A prompt that echoes leaves the master
    // password in the operator's scrollback and in any terminal recording.
    const { promise, written } = drive(["s", "e", "c", "r", "e", "t", "\r"])
    await promise

    expect(written.join("")).toBe("Password: \n")
  })

  it("accepts a whole chunk at once, as a paste arrives", async () => {
    const { promise } = drive(["pasted-password\r"])

    await expect(promise).resolves.toBe("pasted-password")
  })

  it("handles backspace", async () => {
    const { promise } = drive(["a", "b", "c", DEL, DEL, "d", "\r"])

    await expect(promise).resolves.toBe("ad")
  })

  it("does not underflow when backspace is pressed on an empty buffer", async () => {
    const { promise } = drive([DEL, DEL, "x", "\r"])

    await expect(promise).resolves.toBe("x")
  })

  it("treats ctrl-D as end of line, like Enter", async () => {
    const { promise } = drive(["abc", EOT])

    await expect(promise).resolves.toBe("abc")
  })

  it("rejects on ctrl-C instead of accepting a partial password", async () => {
    const { promise } = drive(["abc", ETX])

    await expect(promise).rejects.toThrow(/Cancelled/)
  })

  it("ignores arrow keys instead of inserting escape sequences", async () => {
    // Without this, pressing Left mid-entry silently appends "[D" and the
    // operator's new password is not the one they think they typed.
    const { promise } = drive(["ab", `${ESC}[D`, `${ESC}[A`, "cd", "\r"])

    await expect(promise).resolves.toBe("abcd")
  })

  it("preserves unicode and spaces in a passphrase", async () => {
    const { promise } = drive(["correct horse café 日本", "\r"])

    await expect(promise).resolves.toBe("correct horse café 日本")
  })

  it("restores the terminal and detaches its listener when done", async () => {
    // Leaving stdin in raw mode would wreck the operator's shell after the CLI
    // exits, and a stray listener would swallow later keystrokes.
    const { promise, tty } = drive(["pw", "\r"])
    await promise

    expect(tty.rawMode).toBe(false)
    expect(tty.rawModeHistory).toEqual([true, false])
    expect(tty.listenerCount).toBe(0)
  })

  it("restores the terminal on cancellation too", async () => {
    const { promise, tty } = drive(["pw", ETX])
    await expect(promise).rejects.toThrow()

    expect(tty.rawMode).toBe(false)
    expect(tty.listenerCount).toBe(0)
  })
})

describe("connection string", () => {
  // docker exec does NOT inherit the DATABASE_URL that docker-entrypoint.sh
  // exports, so the CLI has to rebuild it exactly as src/lib/db/index.ts does.

  function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const saved: Record<string, string | undefined> = {}
    for (const k of Object.keys(vars)) {
      saved[k] = process.env[k]
      if (vars[k] === undefined) delete process.env[k]
      else process.env[k] = vars[k]
    }
    try {
      fn()
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  }

  it("prefers DATABASE_URL when the operator set one", () => {
    withEnv({ DATABASE_URL: "postgresql://u:p@host:5432/db" }, () => {
      expect(buildConnectionString()).toBe("postgresql://u:p@host:5432/db")
    })
  })

  it("rebuilds the URL from POSTGRES_* the way the entrypoint does", () => {
    withEnv(
      {
        DATABASE_URL: undefined,
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "plain",
        POSTGRES_HOST: "tracker-tracker-db",
        POSTGRES_PORT: undefined,
        POSTGRES_DB: undefined,
      },
      () => {
        expect(buildConnectionString()).toBe(
          "postgresql://postgres:plain@tracker-tracker-db:5432/tracker_tracker"
        )
      }
    )
  })

  it("percent-encodes a password with URL-significant characters", () => {
    // openssl rand -base64 24 routinely emits '/' and '+'. Without encoding the
    // URL parses into a different host and the operator gets a confusing error
    // in the middle of an emergency.
    withEnv(
      {
        DATABASE_URL: undefined,
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "a/b+c@d:e",
        POSTGRES_HOST: "tracker-tracker-db",
        POSTGRES_PORT: undefined,
        POSTGRES_DB: undefined,
      },
      () => {
        expect(buildConnectionString()).toContain(encodeURIComponent("a/b+c@d:e"))
        expect(buildConnectionString()).toMatch(/@tracker-tracker-db:5432\/tracker_tracker$/)
      }
    )
  })

  it("refuses to guess when there is nothing to build a URL from", () => {
    withEnv({ DATABASE_URL: undefined, POSTGRES_PASSWORD: undefined }, () => {
      expect(() => buildConnectionString()).toThrow(/DATABASE_URL|POSTGRES_PASSWORD/)
    })
  })
})
