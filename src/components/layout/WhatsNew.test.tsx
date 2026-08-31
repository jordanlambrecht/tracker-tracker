// src/components/layout/WhatsNew.test.tsx
//
// Covers parseMissedReleases, the hand-rolled changelog parser behind the
// "What's New" dialog.
//
// The regression this guards against: the parser originally matched only
// asterisk list markers, but CHANGELOG.md carries both. Writer 9 renders every
// bullet through its own list() helper as `*` (see .versionrc.cjs), while the
// 2.9.0 and 2.10.0 sections were written by older tooling as `-`. Those two
// releases hold 148 of the file's 151 dash bullets, so upgrading into either
// one parsed to zero items and the dialog silently fell back to the literal
// string "Bug fixes and improvements." while 97 real entries sat unread.
//
// The last block parses the real CHANGELOG.md rather than a fixture, so a
// future release written with a marker this parser cannot see fails here
// instead of shipping as generic filler.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parseMissedReleases } from "./WhatsNew"

// Mirrors the transform in src/app/api/changelog/route.ts, which strips the
// version header links before the client ever sees the markdown.
function asServed(markdown: string): string {
  return markdown.replace(/## \[([^\]]+)\]\([^)]+\)/g, "## $1")
}

describe("parseMissedReleases", () => {
  it("reads asterisk bullets", () => {
    const md = [
      "## 2.0.0 (2026-01-01)",
      "",
      "### Bug Fixes",
      "",
      "* **api:** fixed a thing",
      "",
    ].join("\n")
    expect(parseMissedReleases(md, "1.0.0")).toEqual(["fixed a thing"])
  })

  it("reads dash bullets", () => {
    const md = [
      "## 2.0.0 (2026-01-01)",
      "",
      "### Bug Fixes",
      "",
      "- **api:** fixed a thing",
      "",
    ].join("\n")
    expect(parseMissedReleases(md, "1.0.0")).toEqual(["fixed a thing"])
  })

  it("reads a section that mixes both markers", () => {
    const md = ["## 2.0.0", "", "* starred", "- dashed", ""].join("\n")
    expect(parseMissedReleases(md, "1.0.0")).toEqual(["starred", "dashed"])
  })

  it("stops at the version the user last saw", () => {
    const md = ["## 2.0.0", "", "- new", "", "## 1.0.0", "", "- old", ""].join("\n")
    expect(parseMissedReleases(md, "1.0.0")).toEqual(["new"])
  })

  it("shows only the newest release when nothing was ever seen", () => {
    const md = ["## 2.0.0", "", "- new", "", "## 1.0.0", "", "- old", ""].join("\n")
    expect(parseMissedReleases(md, null)).toEqual(["new"])
  })

  it("reads every release of the real CHANGELOG.md that has entries", () => {
    const changelog = asServed(readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf-8"))
    const versions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1])
    expect(versions.length).toBeGreaterThan(1)

    // Sections holding only hidden commit types (chore, docs, ci - see
    // .versionrc.cjs) are legitimately empty, so only releases that actually
    // carry a bullet are asserted on. Any of those parsing to nothing means a
    // marker the parser cannot read, which is what produced the fallback text.
    const unreadable = versions.slice(0, -1).filter((v, i) => {
      const section = changelog.slice(changelog.indexOf("## " + v))
      const body = section.slice(0, section.indexOf("## " + versions[i + 1]))
      const hasBullets = /^[*+-]\s+/m.test(body)
      return hasBullets && parseMissedReleases(section, versions[i + 1]).length === 0
    })

    expect(unreadable).toEqual([])
  })
})
