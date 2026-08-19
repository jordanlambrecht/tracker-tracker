// .versionrc.cjs
//
// Config for commit-and-tag-version (`pnpm release:*`).
//
// This is .cjs rather than .json because `writerOpts.commitPartial` has to be a
// FUNCTION. commit-and-tag-version 13 moved to conventional-changelog-writer 9,
// which dropped Handlebars in favour of plain template functions
// (@conventional-changelog/template). The old Handlebars string this file used
// to carry got called as a function and the release died on
// "commitPartial is not a function" after bumping package.json but before
// writing anything else.
//
// Signature and commit fields come from the conventionalcommits preset:
// conventional-changelog-conventionalcommits/src/templates.js.

/**
 * One changelog bullet: `**scope:** subject`, or the bare subject when a commit
 * has no scope.
 *
 * Deliberately narrower than the preset default, which appends a commit-hash
 * link and `, closes #n` / `, references #n` trailers. This changelog is read
 * in-app (see src/app/api/changelog/route.ts) where a wall of hashes is noise,
 * so it renders the human half only. Issue links already inlined in the subject
 * by the writer are left alone.
 *
 * The list marker itself is not ours to pick — writer 9 renders every bullet
 * through its own `list()` helper, which hardcodes `*`. Older entries in
 * CHANGELOG.md use `-`; the file has mixed markers either way.
 *
 * Also not ours: writer 9 trims each release section and appends a single
 * newline, so a new section butts straight up against the previous version
 * heading with no blank line between them. Cosmetic only — an ATX heading
 * interrupts a list in CommonMark, so it still renders as a heading. Accepted
 * rather than papered over with a postchangelog hook.
 */
function commitPartial(_context, commit) {
  const { scope, subject, header } = commit
  const text = subject || header || ""
  return scope ? `**${scope}:** ${text}` : text
}

module.exports = {
  header: "# Changelog\n",
  writerOpts: { commitPartial },
  types: [
    { type: "feat", section: "Features" },
    { type: "fix", section: "Bug Fixes" },
    { type: "perf", section: "Performance" },
    { type: "refactor", section: "Refactoring" },
    { type: "chore", hidden: true },
    { type: "docs", hidden: true },
    { type: "test", hidden: true },
    { type: "ci", hidden: true },
    { type: "style", hidden: true },
  ],
}
