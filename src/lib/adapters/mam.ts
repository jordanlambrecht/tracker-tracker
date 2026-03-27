// src/lib/adapters/mam.ts
//
// Functions: MamAdapter, MamAdapter.fetchStats, MamAdapter.fetchRaw

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

  // snatch_summary categories (present when ?snatch_summary is set)
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

  // notif (present when ?notif is set)
  notifs?: {
    pms: number
    aboutToDropClient: number
    tickets: number
    waiting_tickets: number
    requests: number
    topics: number
  }

  // clientStats (present when ?clientStats is set)
  clientStats?: unknown[]
}

export class MamAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const hostname = new URL(baseUrl).hostname
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("snatch_summary", "")
    url.searchParams.set("notif", "")

    const data = await adapterFetch<MamJsonLoadResponse>(url.toString(), hostname, options, {
      Cookie: `mam_id=${apiToken}`,
    })

    if (!data.username) {
      throw new Error(`Unexpected response from ${hostname}: missing username`)
    }

    const uploaded = BigInt(Math.floor(data.uploaded_bytes ?? 0))
    const downloaded = BigInt(Math.floor(data.downloaded_bytes ?? 0))

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
      bufferBytes: uploaded > downloaded ? uploaded - downloaded : BigInt(0),
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
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []

    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("snatch_summary", "")
    url.searchParams.set("notif", "")
    const endpoint = `${apiPath}?snatch_summary&notif`

    try {
      const data = await adapterFetch<Record<string, unknown>>(url.toString(), hostname, options, {
        Cookie: `mam_id=${apiToken}`,
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
