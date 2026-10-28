// src/lib/__tests__/security-audit-recognizers.test.ts
//
// Tests the recognizers scripts/security-audit.ts uses for checks 6, 12, 17, 29,
// 37 and 38. They live in scripts/security-audit-lib.ts so this suite can import
// them without the audit script's CLI entry running.
//
// Functions:
//   - describe("fetch argument window")
//   - describe("catch body recognizer")
//   - describe("cookie injection guard recognizer")
//   - describe("adapter credential logging detector")
//   - describe("auth result gate recognizer")
//   - describe("encrypt assignment recognizer")

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  CATCH_BODY_MAX_LINES,
  catchBodyLines,
  FETCH_WINDOW_MAX_LINES,
  fetchWindowEnd,
  gatesAuthResult,
  hasInjectionGuard,
  logsCredential,
  stripEncryptAssignment,
  swallowsError,
} from "../../../scripts/security-audit-lib"

const REPO_ROOT = path.resolve(__dirname, "../../..")

// Every file in the audit's scan that interpolates into a Cookie header. Read
// from disk so the recognizer stays tied to the guards the repo ships, not to
// a copy of them.
const GUARDED_FILES = [
  "src/lib/tracker-platforms/adapters/digitalcore.ts",
  "src/lib/tracker-platforms/adapters/mam.ts",
  "src/lib/download-clients/qbt/transport.ts",
]

describe("fetch argument window", () => {
  it("a single line call is its own window", () => {
    const lines = [
      `const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })`,
      `return res.json()`,
    ]

    expect(fetchWindowEnd(lines, 0)).toBe(0)
  })

  it("the window ends on the line that closes the fetch call", () => {
    const lines = [
      `const res = await fetch(url, {`,
      `  headers: buildHeaders(creds),`,
      `  signal: AbortSignal.timeout(10_000),`,
      `})`,
      `const body = await res.text()`,
    ]

    expect(fetchWindowEnd(lines, 0)).toBe(3)
  })

  it("a parenthesis inside a string argument widens the window no further than the 60 line cap", () => {
    const lines = [`await fetch(url, { note: "(", `, ...Array.from({ length: 200 }, () => `  pad`)]

    const end = fetchWindowEnd(lines, 0)

    expect(end).toBe(FETCH_WINDOW_MAX_LINES - 1)
    expect(lines.slice(0, end + 1)).toHaveLength(FETCH_WINDOW_MAX_LINES)
  })

  it("a parenthesis inside a comment widens the window no further than the 60 line cap", () => {
    const lines = [
      `await fetch(url, {`,
      `  // retried by the caller (see scheduler`,
      `  method: "GET",`,
    ]
    const padded = [...lines, ...Array.from({ length: 200 }, () => `  pad`)]

    expect(fetchWindowEnd(padded, 0)).toBe(FETCH_WINDOW_MAX_LINES - 1)
  })

  it("the cap counts from the fetch line, not from the start of the file", () => {
    const lines = [
      `const url = buildUrl()`,
      `await fetch(url, { note: "(", `,
      ...Array.from({ length: 200 }, () => `  pad`),
    ]

    expect(fetchWindowEnd(lines, 1)).toBe(FETCH_WINDOW_MAX_LINES)
  })
})

describe("catch body recognizer", () => {
  it("a return after the block closes does not count as handling", () => {
    const lines = [`  } catch {`, `    // Keep the homepage stats.`, `  }`, `  return stats`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("a return inside the block counts as handling", () => {
    const lines = [`  } catch {`, `    return null`, `  }`]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("a one-line catch that logs is read from its own line", () => {
    const lines = [`  } catch (err) { log.warn({ err }, "profile failed") }`, `  const next = 1`]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("an empty one-line catch is flagged even when a throw follows it", () => {
    const lines = [`    } catch {}`, `    throw new Error("Tracker API error")`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("a nested block does not end the body early", () => {
    const lines = [
      `  } catch (err) {`,
      `    if (err instanceof TypeError) {`,
      `      fallback = { reason: "type" }`,
      `    }`,
      `    log.warn({ err }, "profile failed")`,
      `  }`,
    ]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("a finally block on the closing line is not read as handling", () => {
    const lines = [`  } catch {`, `    copied = false`, `  } finally { log.warn("fallback used") }`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("an unbalanced brace inside a string stops at the 60 line cap", () => {
    const lines = [
      `  } catch {`,
      `    const open = "{"`,
      ...Array.from({ length: 200 }, () => `    pad`),
    ]

    expect(catchBodyLines(lines, 0)).toHaveLength(CATCH_BODY_MAX_LINES)
  })
})

describe("cookie injection guard recognizer", () => {
  it.each(GUARDED_FILES)("accepts the guard %s carries", (relPath) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8")

    expect(hasInjectionGuard(content)).toBe(true)
  })

  it("a guard that is named but not written is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /nothing/\n`)).toBe(false)
  })

  it("a character class that appears only in a comment is rejected", () => {
    const content = `// values are checked against [;\\r\\n] before interpolation\nconst ok = true\n`

    expect(hasInjectionGuard(content)).toBe(false)
  })

  it("a character class inside a block comment is rejected", () => {
    const content = `/**\n * rejects [;\\r\\n\\x00]\n */\nconst ok = true\n`

    expect(hasInjectionGuard(content)).toBe(false)
  })

  it("an empty character class is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[]/\n`)).toBe(false)
  })

  it("a blocklist without a control character is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[;]/\n`)).toBe(false)
  })

  it("a blocklist without a semicolon is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[\\r\\n]/\n`)).toBe(false)
  })

  it("a blocklist holding a semicolon and a control character is accepted", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[;\\r\\n\\x00-\\x1F]/\n`)).toBe(true)
  })

  it("a hex allowlist is accepted without a semicolon", () => {
    expect(hasInjectionGuard(`if (/[^a-fA-F0-9]/.test(sid)) throw new Error("bad")\n`)).toBe(true)
  })
})

describe("adapter credential logging detector", () => {
  it("a pino call that puts a credential in the log object is flagged", () => {
    expect(logsCredential(`log.warn({ apiToken }, "poll failed")`)).toBe(true)
  })

  it.each(["debug", "info", "warn", "error"])(
    "a pino %s call carrying cookies is flagged",
    (level) => {
      expect(logsCredential(`log.${level}({ cookies }, "session replaced")`)).toBe(true)
    }
  )

  it("a console call that puts a credential in the log object is flagged", () => {
    expect(logsCredential(`console.error("login failed for", creds.uid)`)).toBe(true)
  })

  it("a log call that carries only the error is not flagged", () => {
    expect(
      logsCredential(`log.warn({ err }, "digitalcore: enrichment failed, core stats kept")`)
    ).toBe(false)
  })

  it("a field name that merely ends in a credential name is not flagged", () => {
    expect(logsCredential(`log.info({ hasCookies }, "session restored")`)).toBe(false)
  })
})

describe("auth result gate recognizer", () => {
  const logout = fs.readFileSync(path.join(REPO_ROOT, "src/app/api/auth/logout/route.ts"), "utf8")

  it("accepts logout's null check, since logout signs out a stale session too", () => {
    expect(gatesAuthResult("api/auth/logout", logout)).toBe(true)
  })

  it("refuses the same null check on any other route, since a stale session is truthy", () => {
    expect(gatesAuthResult("api/trackers", logout)).toBe(false)
  })

  it("accepts a readSession() caller that checks for a valid status", () => {
    const body = `const session = await readSession()\nif (session?.status !== "valid") return unauthorized()\n`

    expect(gatesAuthResult("api/trackers", body)).toBe(true)
  })

  it("refuses a status check that is commented out", () => {
    const body = `const session = await readSession()\n// if (session?.status !== "valid") return unauthorized()\n`

    expect(gatesAuthResult("api/trackers", body)).toBe(false)
  })
})

describe("encrypt assignment recognizer", () => {
  it.each([
    "    const encryptedConfig = encrypt(JSON.stringify(config), key)",
    "    updates.encryptedConfig = encrypt(JSON.stringify(fields.config), getKey())",
  ])("strips the storage prefix from %j", (line) => {
    expect(stripEncryptAssignment(line)).not.toContain("JSON.stringify")
  })

  it("keeps a property line, since it can sit inside a multi-line NextResponse.json", () => {
    const line = "      encryptedConfig: encrypt(JSON.stringify(config), key),"

    expect(stripEncryptAssignment(line)).toBe(line)
  })
})
