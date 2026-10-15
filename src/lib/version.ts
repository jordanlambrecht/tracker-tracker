// src/lib/version.ts
//
// Functions: compareVersions

// Positive when `latest` is newer than `current`, zero when equal, negative
// when the running build is ahead. Strips a v prefix and pre-release or build
// metadata before comparing numeric segments.
export function compareVersions(current: string, latest: string): number {
  const clean = (s: string) => s.replace(/^v/, "").split(/[-+]/)[0]
  const a = clean(current).split(".").map(Number)
  const b = clean(latest).split(".").map(Number)

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
