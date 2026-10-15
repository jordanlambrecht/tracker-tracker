// src/lib/tracker-platforms/adapters/mam.ts

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import type {
  DebugApiCall,
  FetchOptions,
  MamPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { requireBytes } from "../helpers/bytes"

interface MamSnatchCategory {
  name: string
  count: number
  red?: boolean
  size: number | null
}

/**
 * Responses since 2026-09-23 nest these under snatch_summary; older ones carry
 * them at the top level, which is why the response type extends this too.
 */
interface MamSnatchSummary {
  connectable?: string
  created?: number
  created_at?: string
  ipv6_mac?: boolean
  v6_connectable?: string | null
  partial?: boolean
  recently_deleted?: number

  leeching?: MamSnatchCategory
  sSat?: MamSnatchCategory
  seedHnr?: MamSnatchCategory
  seedUnsat?: MamSnatchCategory
  upAct?: MamSnatchCategory
  upInact?: MamSnatchCategory
  inactHnr?: MamSnatchCategory
  inactSat?: MamSnatchCategory
  inactUnsat?: MamSnatchCategory
  unsat?: MamSnatchCategory & { limit: number }
  duplicates?: { name: string; count: number; red?: boolean }
  reseed?: { name: string; count: number; inactive: number; red?: boolean }
  ite?: { name: string; count: number; latest: number }
}

interface MamJsonLoadResponse extends MamSnatchSummary {
  username: string
  uid: number
  classname: string
  // A display string rather than a number. An account that has downloaded
  // nothing reports "∞". Unused, since fetchStats derives ratio from bytes.
  ratio: string | number
  uploaded: string
  downloaded: string
  uploaded_bytes: number
  downloaded_bytes: number
  seedbonus: number
  wedges: number
  vip_until?: string | null
  country_code?: string
  country_name?: string
  update?: number

  notifs?: {
    pms: number
    aboutToDropClient: number
    tickets: number
    waiting_tickets: number
    requests: number
    topics: number
  }

  clientStats?: unknown[]

  snatch_summary?: MamSnatchSummary
}

// Validate mam_id before interpolation into Cookie header to prevent injection.
// Strips "mam_id=" prefix if someone pasted the full cookie name+value.
function validateMamId(token: string): string {
  let trimmed = token.trim()
  if (!trimmed) throw new Error("MAM session cookie (mam_id) cannot be empty")

  // Common copy-paste mistake: user pastes "mam_id=abc123" instead of just "abc123"
  if (trimmed.toLowerCase().startsWith("mam_id=")) {
    trimmed = trimmed.slice(7).trim()
    if (!trimmed)
      throw new Error("MAM session cookie value is empty after stripping mam_id= prefix")
  }

  // Header injection guard. NUL, CR, and LF make undici throw a TypeError that
  // quotes the whole Cookie header; the rest of the control range is rejected
  // without the value but is kept off the wire all the same.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
  if (/[;\x00-\x1F\x7F]/.test(trimmed)) {
    throw new Error(
      "MAM session cookie (mam_id) contains invalid characters (a semicolon or a control character)"
    )
  }
  // A non-ASCII character is a DevTools truncation mark, never part of a mam_id.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
  const nonAscii = trimmed.match(/[^\x00-\xFF]/)
  if (nonAscii) {
    const code = nonAscii[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")
    throw new Error(
      `MAM session cookie (mam_id) contains a non-ASCII character ("${nonAscii[0]}", U+${code}) at position ${nonAscii.index}. ` +
        "This usually means the browser truncated the value when copying. Re-copy it from DevTools."
    )
  }
  return trimmed
}

export class MamAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const mamId = validateMamId(apiToken)
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("snatch_summary", "")
    url.searchParams.set("notif", "")

    const data = await adapterFetch<MamJsonLoadResponse>(url.toString(), hostname, options, {
      Cookie: `mam_id=${mamId}`,
    })

    if (!data.username) {
      throw new Error(`Unexpected response from ${hostname}: missing username`)
    }

    const uploaded = requireBytes(data.uploaded_bytes, "uploaded_bytes", hostname)
    const downloaded = requireBytes(data.downloaded_bytes, "downloaded_bytes", hostname)
    const snatch: MamSnatchSummary = { ...data, ...data.snatch_summary }

    // A missing category really is none in that category, but every category
    // missing means the summary block never arrived, which is unknown rather
    // than an account seeding nothing.
    const seedingCategories = [
      snatch.sSat?.count,
      snatch.seedHnr?.count,
      snatch.seedUnsat?.count,
      snatch.upAct?.count,
    ]
    const seedingCount = seedingCategories.some((c) => typeof c === "number")
      ? seedingCategories.reduce((sum: number, c) => sum + (c ?? 0), 0)
      : null

    const platformMeta: MamPlatformMeta = {
      vipUntil: data.vip_until ?? undefined,
      connectable: snatch.connectable ?? undefined,
      unsatisfiedCount: snatch.unsat?.count ?? undefined,
      unsatisfiedLimit: snatch.unsat?.limit ?? undefined,
      inactiveSatisfiedCount: snatch.inactSat?.count ?? undefined,
      seedingHnrCount: snatch.seedHnr?.count ?? undefined,
      inactiveUnsatisfiedCount: snatch.inactUnsat?.count ?? undefined,
      trackerErrorCount: snatch.ite?.count ?? undefined,
      recentlyDeleted: snatch.recently_deleted ?? undefined,
      unreadPMs: data.notifs?.pms ?? undefined,
      openTickets: data.notifs?.tickets ?? undefined,
      pendingRequests: data.notifs?.requests ?? undefined,
      unreadTopics: data.notifs?.topics ?? undefined,
    }

    return {
      username: data.username,
      group: data.classname ?? "Unknown",
      remoteUserId: data.uid,
      uploadedBytes: uploaded,
      downloadedBytes: downloaded,
      // Derived from byte totals rather than read from data.ratio, which is a
      // display string ("∞" for an account that has downloaded nothing).
      ratio: computeRatio(uploaded, downloaded),
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount,
      leechingCount: snatch.leeching?.count ?? null,
      seedbonus: data.seedbonus ?? null,
      hitAndRuns: snatch.inactHnr?.count ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: data.wedges ?? null,
      platformMeta,
    }
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const mamId = validateMamId(apiToken)
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []

    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("snatch_summary", "")
    url.searchParams.set("notif", "")
    const endpoint = `${apiPath}?snatch_summary&notif`

    try {
      const data = await adapterFetch<Record<string, unknown>>(url.toString(), hostname, options, {
        Cookie: `mam_id=${mamId}`,
      })
      // fetchStats treats a body with no username as a rejected mam_id, so
      // reporting it as a healthy call here would hide exactly that.
      calls.push({
        label: "User Stats",
        endpoint,
        data,
        error: data.username ? null : `Unexpected response from ${hostname}: missing username`,
      })
    } catch (err) {
      calls.push({
        label: "User Stats",
        endpoint,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }

    return calls
  }
}
