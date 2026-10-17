// src/lib/tracker-platforms/__tests__/conformance.test.ts
//
// Rules about the source text itself, so a reviewer of contributed code never
// has to check them by hand. Every exception is an allowlist line with a reason.

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const MODULE_DIR = path.resolve(process.cwd(), "src/lib/tracker-platforms")
const ADAPTERS_DIR = path.join(MODULE_DIR, "adapters")
const HELPERS_DIR = path.join(MODULE_DIR, "helpers")
const TESTS_DIR = path.join(MODULE_DIR, "__tests__")

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith(".ts")) out.push(full)
  }
  return out
}

const ALL = walk(MODULE_DIR)
const SOURCE = ALL.filter((f) => !f.endsWith(".test.ts"))
const repoPath = (abs: string) => path.relative(process.cwd(), abs).replace(/\\/g, "/")
const read = (abs: string) => fs.readFileSync(abs, "utf8")

/** Reported as `file: matched text`, so a failure names what to look at. */
function findAll(pattern: RegExp, files: string[]): string[] {
  const hits: string[] = []
  for (const file of files) {
    const lines = read(file).split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
      const m = line.match(pattern)
      if (m) hits.push(`${repoPath(file)}: ${m[0].trim()}`)
    }
  }
  return hits
}

describe("tracker-platforms source conformance", () => {
  it("starts every file with its own path", () => {
    const wrong = ALL.filter((f) => !read(f).startsWith(`// ${repoPath(f)}`))
    expect(wrong.map(repoPath)).toEqual([])
  })

  it("uses no em dash anywhere in the module", () => {
    // Prose review cannot see one reliably; a test can.
    // Written as an escape so this file does not trip its own rule.
    const EM_DASH = "\u2014"
    const hits = ALL.filter((f) => read(f).includes(EM_DASH)).map(repoPath)
    expect(hits).toEqual([])
  })

  it("does not use the one word banned repo-wide", () => {
    const hits = ALL.filter((f) => /\bseam\b/i.test(read(f))).map(repoPath)
    expect(hits).toEqual([])
  })

  // No console case, since Biome's noConsole already covers this module, tests
  // included.

  it("parses credential blobs with the shared helper", () => {
    const ALLOWED = new Set([
      // DigitalCore's parser predates parseCredentialJson. Its messages and its
      // cookie-injection guards are deliberate and differ from the shared one,
      // so it is exempt until someone reconciles the wording.
      "src/lib/tracker-platforms/adapters/digitalcore.ts",
    ])
    // Scoped to adapters: parseCredentialJson in helpers/ is the one place
    // this is supposed to happen.
    const adapterSources = SOURCE.filter((f) => f.startsWith(ADAPTERS_DIR))
    const hits = findAll(/JSON\.parse\(apiToken/, adapterSources).filter(
      (h) => !ALLOWED.has(h.split(":")[0])
    )
    expect(hits).toEqual([])
  })

  it("never coalesces an absent figure into a measured value", () => {
    // Adding a default means adding an allowlist line here with a reason.
    const ALLOWED = new Set([
      // Summing seeding categories, guarded by a some(typeof === "number")
      // above it, so a category the response omitted contributes nothing to a
      // total that is itself null when every category is absent.
      "src/lib/tracker-platforms/adapters/mam.ts",
      // A JSON null bonus counts as no bonus, the way TR4KER's own pages add it
      // to the totals; an absent bonus key fails the poll before the default.
      "src/lib/tracker-platforms/adapters/tr4ker.ts",
    ])
    // `?? 0n` is in scope: a byte total is non-nullable bigint, so an adapter that
    // cannot read one throws rather than storing a measured zero (standard 2.1).
    const pattern = /\?\?\s*(?:0n?|false|true)\b|parseInt\([^)]*\)\s*\|\|\s*0\b/
    const hits = findAll(pattern, SOURCE).filter((h) => !ALLOWED.has(h.split(":")[0]))
    expect(hits).toEqual([])
  })

  it("gives every adapter a test file that exercises fetchRaw", () => {
    const missing: string[] = []
    for (const adapter of fs.readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith(".ts"))) {
      const testFile = path.join(TESTS_DIR, adapter.replace(/\.ts$/, ".test.ts"))
      if (!fs.existsSync(testFile)) {
        missing.push(`${adapter}: no test file`)
        continue
      }
      if (!read(testFile).includes(".fetchRaw(")) {
        missing.push(`${adapter}: test file never calls fetchRaw`)
      }
    }
    expect(missing).toEqual([])
  })

  it("gives every logic-bearing helper a test file", () => {
    // Declaration-only helpers have nothing to exercise.
    const DECLARATION_ONLY = new Set(["errors.ts"])
    const missing: string[] = []
    for (const helper of fs.readdirSync(HELPERS_DIR).filter((f) => f.endsWith(".ts"))) {
      if (DECLARATION_ONLY.has(helper)) continue
      const testFile = path.join(TESTS_DIR, helper.replace(/\.ts$/, ".test.ts"))
      if (!fs.existsSync(testFile)) missing.push(helper)
    }
    expect(missing).toEqual([])
  })

  it("keeps the Functions: header honest wherever a file carries one", () => {
    // A manifest that is wrong is worse than none: a contributor trusts it and
    // writes a duplicate helper. Either it is verified or it should be dropped.
    const wrong: string[] = []
    for (const file of SOURCE) {
      const body = read(file)
      const header: string[] = []
      let inHeader = false
      for (const line of body.split("\n")) {
        if (/^\/\/\s*(?:Available functions|Functions):/.test(line)) inHeader = true
        else if (inHeader && !line.startsWith("//")) break
        if (inHeader) header.push(line)
      }
      if (!header.length) continue
      const listed = new Set(header.join(" ").match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])
      const declared = [
        ...(body.match(/^(?:export )?(?:async )?function (\w+)/gm) ?? []).map((m) =>
          m.replace(/^(?:export )?(?:async )?function /, "")
        ),
        ...(body.match(/^export class (\w+)/gm) ?? []).map((m) => m.replace("export class ", "")),
      ]
      const missing = declared.filter((d) => !listed.has(d))
      if (missing.length) wrong.push(`${repoPath(file)}: omits ${missing.join(", ")}`)
    }
    expect(wrong).toEqual([])
  })
  it("keeps the adapters folder holding only adapters", () => {
    // The layout rule itself. adapters/ is the crowdsourced surface; shared
    // code belongs in helpers/ and the contract at the module root.
    const stray = fs
      .readdirSync(ADAPTERS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.name.endsWith(".test.ts"))
      .map((e) => e.name)
    expect(stray).toEqual([])
  })
})
