// src/lib/download-clients/__tests__/transmission-adapter.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TransmissionTorrent } from "../transmission/types"
import { TransmissionStatus } from "../transmission/types"
import type { ClientAdapter } from "../types"

vi.mock("@/lib/download-clients/transmission/transport", () => ({
  getTorrents: vi.fn(),
  getSessionStats: vi.fn().mockResolvedValue({ uploadSpeed: 500, downloadSpeed: 200 }),
  invalidateSessionId: vi.fn(),
  testSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/download-clients/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download-clients/transport")>()),
  clearAuthBlocks: vi.fn(),
}))

import {
  getSessionStats,
  getTorrents,
  invalidateSessionId,
  testSession,
} from "@/lib/download-clients/transmission/transport"
import { clearAuthBlocks } from "@/lib/download-clients/transport"
import { TransmissionClientAdapter } from "../adapters/transmission"

function torrent(over: Partial<TransmissionTorrent>): TransmissionTorrent {
  return {
    hashString: "abc",
    name: "Test",
    status: TransmissionStatus.SEED,
    labels: [],
    rateUpload: 0,
    rateDownload: 0,
    uploadedEver: 0,
    downloadedEver: 0,
    uploadRatio: 1,
    sizeWhenDone: 100,
    peersSendingToUs: 0,
    peersGettingFromUs: 0,
    addedDate: 1700000000,
    doneDate: 1700001000,
    activityDate: 1700002000,
    secondsSeeding: 10,
    secondsDownloading: 5,
    leftUntilDone: 0,
    percentDone: 1,
    downloadDir: "/data",
    isPrivate: true,
    trackers: [],
    ...over,
  }
}

const CREDS = {
  authMethod: "password" as const,
  username: "admin",
  password: "p",
  urlPath: "",
  credentialKey: "password:enc-admin:enc-p",
}

function adapter() {
  return new TransmissionClientAdapter("localhost", 9091, false, CREDS)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSessionStats).mockResolvedValue({ uploadSpeed: 500, downloadSpeed: 200 })
  vi.mocked(testSession).mockResolvedValue(undefined)
})

describe("TransmissionClientAdapter", () => {
  it("identifies itself and builds its base URL", () => {
    const a = adapter()
    expect(a.type).toBe("transmission")
    expect(a.baseUrl).toBe("http://localhost:9091")
    expect(new TransmissionClientAdapter("host", 443, true, CREDS).baseUrl).toBe("https://host:443")
  })

  it("keeps the URL path in its base URL, which is the sync store key", () => {
    const a = new TransmissionClientAdapter("host", 9091, false, { ...CREDS, urlPath: "/torrents" })
    expect(a.baseUrl).toBe("http://host:9091/torrents")
  })

  it("does not implement delta sync, so the scheduler takes its full-fetch path", () => {
    // Transmission has no sync/maindata equivalent. The scheduler branches on
    // `if (adapter.getDeltaSync)`, so this absence is load-bearing. Asserted
    // through the interface, which is where the optional method is declared.
    const a: ClientAdapter = adapter()
    expect(a.getDeltaSync).toBeUndefined()
  })

  it("returns mapped TorrentRecords, not raw RPC shapes", async () => {
    vi.mocked(getTorrents).mockResolvedValueOnce([torrent({ secondsSeeding: 86400 })])
    const [t] = await adapter().getTorrents()
    expect(t.hash).toBe("abc")
    expect(t.seedingTime).toBe(86400)
    expect(t.state).toBe("stalledUP")
  })

  it("filters by label locally, case-insensitively", async () => {
    vi.mocked(getTorrents).mockResolvedValue([
      torrent({ hashString: "a", labels: ["Aither"] }),
      torrent({ hashString: "b", labels: ["other"] }),
      torrent({ hashString: "c", labels: [] }),
    ])
    const result = await adapter().getTorrents({ tag: "aither" })
    expect(result.map((t) => t.hash)).toEqual(["a"])
  })

  it("does not match a tag against a substring of another tag", async () => {
    vi.mocked(getTorrents).mockResolvedValue([torrent({ hashString: "a", labels: ["aither-hd"] })])
    expect(await adapter().getTorrents({ tag: "aither" })).toHaveLength(0)
  })

  it("applies the active filter on transfer rate in either direction", async () => {
    vi.mocked(getTorrents).mockResolvedValue([
      torrent({ hashString: "up", rateUpload: 100 }),
      torrent({ hashString: "down", rateDownload: 100 }),
      torrent({ hashString: "idle" }),
    ])
    const result = await adapter().getTorrents({ filter: "active" })
    expect(result.map((t) => t.hash).sort()).toEqual(["down", "up"])
  })

  it("asks for recently active torrents only when filtering for active ones", async () => {
    vi.mocked(getTorrents).mockResolvedValue([])
    await adapter().getTorrents({ filter: "active" })
    await adapter().getTorrents({ tag: "tl" })
    expect(vi.mocked(getTorrents).mock.calls[0][2]).toMatchObject({ recentlyActive: true })
    expect(vi.mocked(getTorrents).mock.calls[1][2]).toMatchObject({ recentlyActive: false })
  })

  it("hands the caller's signal to the transport", async () => {
    vi.mocked(getTorrents).mockResolvedValue([])
    const caller = new AbortController()
    await adapter().getTorrents({ signal: caller.signal })
    expect(vi.mocked(getTorrents).mock.calls[0][2]?.signal).toBe(caller.signal)
  })

  it("applies tag and filter together", async () => {
    vi.mocked(getTorrents).mockResolvedValue([
      torrent({ hashString: "a", labels: ["tl"], rateUpload: 100 }),
      torrent({ hashString: "b", labels: ["tl"] }),
      torrent({ hashString: "c", labels: ["other"], rateUpload: 100 }),
    ])
    const result = await adapter().getTorrents({ tag: "tl", filter: "active" })
    expect(result.map((t) => t.hash)).toEqual(["a"])
  })

  it("clears the auth blocks before an explicit connection test, keeping the store", async () => {
    // The fix may have been a daemon restart or a whitelist change, which no
    // credential comparison can see, so the test must reach the network. The
    // session id stays: dropping it also resets the torrent store, which sends
    // the fleet to the cache until the next poll.
    vi.mocked(invalidateSessionId).mockClear()
    await adapter().testConnection()
    expect(invalidateSessionId).not.toHaveBeenCalled()
    expect(clearAuthBlocks).toHaveBeenCalledWith("http://localhost:9091")
    expect(vi.mocked(clearAuthBlocks).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(testSession).mock.invocationCallOrder[0]
    )
  })

  it("drops its cached session and auth blocks on dispose", () => {
    adapter().dispose()
    expect(invalidateSessionId).toHaveBeenCalledWith("http://localhost:9091")
    expect(clearAuthBlocks).toHaveBeenCalledWith("http://localhost:9091")
  })
})
