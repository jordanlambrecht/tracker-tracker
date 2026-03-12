// src/hooks/useUpdateCheck.ts
//
// Functions: useUpdateCheck, compareVersions

import { useEffect, useRef, useState } from "react"

const GITHUB_REPO = "jordanlambrecht/tracker-tracker"

interface UpdateCheckResult {
  latestVersion: string | null
  updateAvailable: boolean
  loading: boolean
}

/**
 * Compares two semver strings. Returns > 0 if latest is newer, 0 if equal, < 0 if current is newer.
 */
export function compareVersions(current: string, latest: string): number {
  // Strip v prefix and pre-release/build metadata (e.g., "1.3.0-beta.1+build" → "1.3.0")
  const clean = (s: string) => s.replace(/^v/, "").split(/[-+]/)[0]
  const a = clean(current).split(".").map(Number)
  const b = clean(latest).split(".").map(Number)

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Checks GitHub for a newer version. Runs once per session (cached via ref).
 * Tries Releases API first, falls back to Tags API.
 */
export function useUpdateCheck(): UpdateCheckResult {
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    async function check() {
      try {
        // Try GitHub Releases API first (has explicit "latest" concept)
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
          { headers: { Accept: "application/vnd.github.v3+json" } }
        )

        if (res.ok) {
          const data = await res.json()
          const tag = (data.tag_name as string)?.replace(/^v/, "")
          if (tag) {
            setLatestVersion(tag)
            return
          }
        }

        // Fall back to Tags API (created by `pnpm version` + `git push --tags`)
        const tagRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`,
          { headers: { Accept: "application/vnd.github.v3+json" } }
        )

        if (tagRes.ok) {
          const tags = (await tagRes.json()) as { name: string }[]
          if (tags.length > 0) {
            setLatestVersion(tags[0].name.replace(/^v/, ""))
          }
        }
      } catch {
        // Network error (offline, blocked, private repo) — silently skip
      } finally {
        setLoading(false)
      }
    }

    check()
  }, [])

  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"
  const updateAvailable =
    latestVersion !== null && compareVersions(currentVersion, latestVersion) > 0

  return { latestVersion, updateAvailable, loading }
}
