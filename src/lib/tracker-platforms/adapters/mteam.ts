// src/lib/tracker-platforms/adapters/mteam.ts
//
// Functions: roleName, rawBytes, numeric, dateOnly, integer, unwrap,
// readProfile, readPeerStatus, MteamAdapter

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateHeaderToken } from "@/lib/tracker-credentials/header-token"
import type {
  DebugApiCall,
  FetchOptions,
  MteamPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { adapterFetch } from "../helpers/adapter-fetch"
import { pollError } from "../helpers/poll-error"

// M-Team serves its JSON API from a fixed host, separate from the web UI.
// The API host is part of the protocol, so it lives here rather than in the
// registry's url; the registry path is only the endpoint.
const MTEAM_API_BASE = "https://api.m-team.cc"
const PROFILE_PATH = "/api/member/profile"
// Active torrent counts live on myPeerStatus. myPeerStatistics also exists,
// but it requires a uid and reports zeros without one; myPeerStatus needs no
// parameters and returns { seeder, leecher } for the API key's account.
const PEER_STATUS_PATH = "/api/tracker/myPeerStatus"

interface MteamEnvelope<T> {
  code?: string | number
  message?: string
  data?: T
}

interface MteamProfile {
  id?: string | number
  username?: string
  createdDate?: string
  lastModifiedDate?: string
  role?: string | number
  memberCount?: {
    uploaded?: string | number
    downloaded?: string | number
    bonus?: string | number
    shareRate?: string | number
  }
  memberStatus?: {
    lastBrowse?: string
    vip?: boolean
  }
}

interface MteamPeerStatus {
  seeder?: string | number
  leecher?: string | number
}

interface MteamPeerReadout {
  seedingCount: number | null
  leechingCount: number | null
}

// M-Team returns the role as an id, not a name. The registry ladder uses the
// nine classes and VIP confirmed by the site's rules page. The community map
// in pt-tools also lists Retiree/Uploader/Moderator/Administrator/Sysop for
// 11-15, but that map is outdated elsewhere (it still calls 9 "Nexus Master"),
// so unconfirmed ids stay null instead of being labelled.
const ROLE_NAMES: Record<string, string> = {
  "1": "User",
  "2": "Power User",
  "3": "Elite User",
  "4": "Crazy User",
  "5": "Insane User",
  "6": "Veteran User",
  "7": "Extreme User",
  "8": "Ultimate User",
  "9": "mTorrent Master",
  "10": "VIP",
}

function roleName(role: unknown): string | null {
  const id = typeof role === "number" ? String(role) : typeof role === "string" ? role.trim() : ""
  return id !== "" && Object.hasOwn(ROLE_NAMES, id) ? ROLE_NAMES[id] : null
}

/**
 * M-Team sends byte totals as decimal strings, not numbers. An absent total
 * fails the poll instead of being stored as a measured zero (adapter standard
 * 2.1).
 */
function rawBytes(value: unknown, field: string, hostname: string): bigint {
  if (value == null) {
    throw new Error(`Unexpected response from ${hostname}: missing ${field}`)
  }
  const text =
    typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : ""
  if (!/^\d+$/.test(text)) {
    throw new Error(`Unexpected response from ${hostname}: non-numeric ${field}`)
  }
  return BigInt(text)
}

/** A decimal field, or null when the API omitted it or sent something else. */
function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || value.trim() === "") return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** M-Team dates are site-local "YYYY-MM-DD HH:mm:ss"; only the day is stored. */
function dateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

function integer(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function remoteId(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * M-Team wraps every answer in { code, message, data }. A zero/"SUCCESS" code
 * is the only success signal; an HTTP 200 with any other code is a failure.
 */
function unwrap<T>(body: MteamEnvelope<T>, hostname: string): T {
  const code = body?.code
  const success =
    code === 0 ||
    code === "0" ||
    code === 200 ||
    code === "200" ||
    String(code).toLowerCase() === "success"

  if (!success) {
    const message = typeof body?.message === "string" ? body.message.trim() : ""
    throw new Error(message || `M-Team API request failed on ${hostname}`)
  }
  if (body.data == null || typeof body.data !== "object") {
    throw new Error(`Unexpected response from ${hostname}: missing data`)
  }
  return body.data
}

function readPeerStatus(body: MteamEnvelope<MteamPeerStatus>, hostname: string): MteamPeerReadout {
  const data = unwrap(body, hostname)
  return {
    seedingCount: integer(data.seeder),
    leechingCount: integer(data.leecher),
  }
}

function readProfile(body: MteamEnvelope<MteamProfile>, hostname: string): TrackerStats {
  const data = unwrap(body, hostname)
  const uploadedBytes = rawBytes(data.memberCount?.uploaded, "uploaded", hostname)
  const downloadedBytes = rawBytes(data.memberCount?.downloaded, "downloaded", hostname)
  const reportedRatio = numeric(data.memberCount?.shareRate)

  const meta: MteamPlatformMeta = {}
  if (typeof data.memberStatus?.vip === "boolean") meta.vip = data.memberStatus.vip

  return {
    username: typeof data.username === "string" ? data.username : "",
    group: roleName(data.role),
    uploadedBytes,
    downloadedBytes,
    ratio:
      downloadedBytes === 0n
        ? computeRatio(uploadedBytes, downloadedBytes)
        : (reportedRatio ?? computeRatio(uploadedBytes, downloadedBytes)),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount: null,
    leechingCount: null,
    seedbonus: numeric(data.memberCount?.bonus),
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    remoteUserId: remoteId(data.id),
    joinedDate: dateOnly(data.createdDate),
    lastAccessDate: dateOnly(data.memberStatus?.lastBrowse) ?? dateOnly(data.lastModifiedDate),
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

async function request<T>(
  path: string,
  token: string,
  hostname: string,
  options?: FetchOptions
): Promise<MteamEnvelope<T>> {
  const url = new URL(path, MTEAM_API_BASE).toString()
  return adapterFetch<MteamEnvelope<T>>(
    url,
    hostname,
    options,
    {
      "x-api-key": token,
      "Content-Type": "application/json",
    },
    { method: "POST", body: "{}" }
  )
}

export class MteamAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const token = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const path = apiPath || PROFILE_PATH

    const profile = readProfile(
      await request<MteamProfile>(path, token, hostname, options),
      hostname
    )

    // Peer counts are enrichment. A failure leaves them unknown instead of
    // discarding the profile totals that already passed.
    let peer: MteamPeerReadout | null = null
    try {
      peer = readPeerStatus(
        await request<MteamPeerStatus>(PEER_STATUS_PATH, token, hostname, options),
        hostname
      )
    } catch {
      peer = null
    }

    profile.seedingCount = peer?.seedingCount ?? null
    profile.leechingCount = peer?.leechingCount ?? null

    return profile
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const token = validateHeaderToken(apiToken)
    const hostname = new URL(baseUrl).hostname
    const path = apiPath || PROFILE_PATH
    const calls: DebugApiCall[] = []

    try {
      const body = await request<MteamProfile>(path, token, hostname, options)
      calls.push({
        label: "Profile",
        endpoint: path,
        data: body,
        error: pollError(() => readProfile(body, hostname)),
      })
    } catch (err) {
      calls.push({ label: "Profile", endpoint: path, data: null, error: errorMessage(err) })
    }

    try {
      const body = await request<MteamPeerStatus>(PEER_STATUS_PATH, token, hostname, options)
      calls.push({
        label: "Peer Status",
        endpoint: PEER_STATUS_PATH,
        data: body,
        error: pollError(() => readPeerStatus(body, hostname)),
      })
    } catch (err) {
      calls.push({
        label: "Peer Status",
        endpoint: PEER_STATUS_PATH,
        data: null,
        error: errorMessage(err),
      })
    }

    return calls
  }
}
