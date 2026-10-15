// src/lib/__tests__/security-audit-recognizers.test.ts
//
// Pins the three recognizers scripts/security-audit.ts uses for its critical
// checks. They live in scripts/security-audit-lib.ts so this suite can import
// them without the audit script's CLI entry running.
//
// Functions:
//   - describe("fetch argument window")
//   - describe("cookie injection guard recognizer")
//   - describe("adapter credential logging detector")

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  FETCH_WINDOW_MAX_LINES,
  fetchWindowEnd,
  hasInjectionGuard,
  logsCredential,
} from "../../../scripts/security-audit-lib"

const REPO_ROOT = path.resolve(__dirname, "../../..")

// Every file in the audit's scan that interpolates into a Cookie header. Read
// from disk so the recognizer stays pinned to the guards the repo ships, not to
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
