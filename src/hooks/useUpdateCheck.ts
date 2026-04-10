// src/hooks/useUpdateCheck.ts
import { useQuery } from "@tanstack/react-query"

const GITHUB_REPO = "jordanlambrecht/tracker-tracker"

interface UpdateCheckResult {
  latestVersion: string | null
  updateAvailable: boolean
  loading: boolean
}

// Compares two semver strings
export function compareVersions(current: string, latest: string): number {
  // Strip v prefix and pre-release/build metadata (i.e, "1.3.0-beta.1+build" → "1.3.0")
  const clean = (s: string) => s.replace(/^v/, "").split(/[-+]/)[0]
  const a = clean(current).split(".").map(Number)
  const b = clean(latest).split(".").map(Number)

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    // Try GitHub Releases API first
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })

    if (res.ok) {
      const data = await res.json()
      const tag = (data.tag_name as string)?.replace(/^v/, "")
      if (tag) return tag
    }

    // Fall back to Tags API
    const tagRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })

    if (tagRes.ok) {
      const tags = (await tagRes.json()) as { name: string }[]
      if (tags.length > 0) return tags[0].name.replace(/^v/, "")
    }
  } catch {
    // Network error
  }
  return null
}

/**
 * Checks GitHub for a newer version. Uses TanStack Query with staleTime: Infinity
 * so the check runs at most once per session, even when called from multiple components.
 */
export function useUpdateCheck(): UpdateCheckResult {
  const { data: latestVersion = null, isLoading: loading } = useQuery({
    queryKey: ["update-check"],
    queryFn: fetchLatestVersion,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"
  const updateAvailable =
    latestVersion !== null && compareVersions(currentVersion, latestVersion) > 0

  return { latestVersion, updateAvailable, loading }
}
