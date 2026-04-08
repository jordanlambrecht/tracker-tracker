// src/lib/adapters/mam.ts

import { computeBufferBytes, floatBytesToBigInt } from "@/lib/data-transforms"
import { adapterFetch } from "./adapter-fetch"
import type {
  DebugApiCall,
  FetchOptions,
  MamPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "./types"

interface MamSnatchCategory {
  name: string
  count: number
  red: boolean
  size: number | null
}

interface MamJsonLoadResponse {
  username: string
  uid: number
  classname: string
  ratio: number
  uploaded: string
  downloaded: string
  uploaded_bytes: number
  downloaded_bytes: number
  seedbonus: number
  wedges: number
  vip_until?: string | null
  connectable?: string
  country_code?: string
  country_name?: string
  created?: number
  update?: number
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
  duplicates?: MamSnatchCategory
  reseed?: { name: string; count: number; inactive: number; red: boolean }
  ite?: { name: string; count: number; latest: number }

  notifs?: {
    pms: number
    aboutToDropClient: number
    tickets: number
    waiting_tickets: number
    requests: number
    topics: number
  }

  clientStats?: unknown[]
}

// Validate mam_id before interpolation into Cookie header to prevent injection.
// Strips "mam_id=" prefix if someone pasted the full cookie name+value.
function validateMamId(token: string): string {
  let trimmed = token.trim()
  if (!trimmed) throw new Error("MAM session cookie (mam_id) cannot be empty")

  // Common copy-paste mistake: user pastes "mam_id=abc123" instead of just "abc123"
  if (trimmed.toLowerCase().startsWith("mam_id=")) {
    trimmed = trimmed.slice(7).trim()
    if (!trimmed) throw new Error("MAM session cookie value is empty after stripping mam_id= prefix")
  }

  // Block header injection characters
  if (/[;\r\n]/.test(trimmed)) {
    throw new Error("MAM session cookie (mam_id) contains invalid characters (semicolons or newlines)")
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

    const uploaded = floatBytesToBigInt(data.uploaded_bytes)
    const downloaded = floatBytesToBigInt(data.downloaded_bytes)

    const seedingCount =
      (data.sSat?.count ?? 0) +
      (data.seedHnr?.count ?? 0) +
      (data.seedUnsat?.count ?? 0) +
      (data.upAct?.count ?? 0)

    const platformMeta: MamPlatformMeta = {
      vipUntil: data.vip_until ?? undefined,
      connectable: data.connectable ?? undefined,
      unsatisfiedCount: data.unsat?.count ?? undefined,
      unsatisfiedLimit: data.unsat?.limit ?? undefined,
      inactiveSatisfiedCount: data.inactSat?.count ?? undefined,
      seedingHnrCount: data.seedHnr?.count ?? undefined,
      inactiveUnsatisfiedCount: data.inactUnsat?.count ?? undefined,
      trackerErrorCount: data.ite?.count ?? undefined,
      recentlyDeleted: data.recently_deleted ?? undefined,
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
      ratio: typeof data.ratio === "number" ? data.ratio : parseFloat(String(data.ratio)) || 0,
      bufferBytes: computeBufferBytes(uploaded, downloaded),
      seedingCount,
      leechingCount: data.leeching?.count ?? 0,
      seedbonus: data.seedbonus ?? null,
      hitAndRuns: data.inactHnr?.count ?? null,
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
      calls.push({ label: "User Stats", endpoint, data, error: null })
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
