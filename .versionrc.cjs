// .versionrc.cjs
//
// Config for commit-and-tag-version (`pnpm release:*`).
//
// Must stay .cjs rather than .json, because writerOpts.commitPartial has to be
// a function. conventional-changelog-writer 9 dropped Handlebars, so a template
// string here gets called as a function and the release fails mid-bump.

/**
 * One changelog bullet: `**scope:** subject`, or the bare subject with no scope.
 *
 * Narrower than the preset default, which also appends a commit-hash link and
 * `closes #n` trailers. This changelog renders in-app
 * (src/app/api/changelog/route.ts), where hashes are noise.
 *
 * The `*` list marker is writer 9's own, hardcoded in its `list()` helper.
 * Older CHANGELOG.md entries use `-`, so the file carries both.
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
