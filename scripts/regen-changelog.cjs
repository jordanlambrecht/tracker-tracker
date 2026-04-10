// scripts/regen-changelog.cjs
// Regenerates CHANGELOG.md using the conventionalcommits preset,
// then post-processes to match .versionrc.json preferences.

const { execFileSync } = require("node:child_process")
const { readFileSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")

const root = join(__dirname, "..")
const changelog = join(root, "CHANGELOG.md")

// 1. Generate with the conventionalcommits preset
execFileSync(
  "pnpm",
  ["conventional-changelog", "-p", "conventionalcommits", "-i", "CHANGELOG.md", "-s", "-r", "0"],
  {
    cwd: root,
    stdio: "inherit",
  }
)

// 2. Post-process to match .versionrc.json preferences
let content = readFileSync(changelog, "utf-8")

// Add header
if (!content.startsWith("# Changelog")) {
  content = `# Changelog\n${content}`
}

// Strip commit hash links: ([abc1234](https://github.com/.../commit/...))
content = content.replace(/ \(\[[a-f0-9]{7,}\]\(https?:\/\/[^)]+\/commit\/[^)]+\)\)/g, "")

// Strip all issue links: closes [#123](...), (#123), [#123](...)
content = content.replace(/,?\s*closes\s+\[#\d+\]\([^)]+\)/g, "")
content = content.replace(/ \[#\d+\]\([^)]+\)/g, "")
content = content.replace(/ \(#\d+\)/g, "")

// Clean up empty/orphaned parens left after stripping
content = content.replace(/ \( and \)/g, "")
content = content.replace(/ \(\)/g, "")
content = content.replace(/ \( \)/g, "")

// Remove sections not shown in-app (heading + all bullets until next heading or blank line)
content = content.replace(/### Performance(?:\s+Improvements)?\n\n(?:\*[^\n]*\n)*/g, "")
content = content.replace(/### Refactoring\n\n(?:\*[^\n]*\n)*/g, "")
content = content.replace(/### Reverts\n\n(?:\*[^\n]*\n)*/g, "")

// Rewrite version header links: compare URL → release URL
content = content.replace(
  /## \[([^\]]+)\]\(https:\/\/github\.com\/([^/]+)\/([^/]+)\/compare\/[^)]+\)/g,
  "## [$1](https://github.com/$2/$3/releases/tag/v$1)"
)

// Collapse triple+ blank lines to double
content = content.replace(/\n{3,}/g, "\n\n")

writeFileSync(changelog, `${content.trimEnd()}\n`)
console.log(`Regenerated ${changelog} (${content.split("\n").length} lines)`)
