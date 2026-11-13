// src/lib/download-clients/__tests__/rtorrent-adapter.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RtorrentTorrent } from "../rtorrent/types"

vi.mock("@/lib/download-clients/rtorrent/transport", () => ({
  getTorrents: vi.fn(),
  getTransferStats: vi.fn().mockResolvedValue({ uploadSpeed: 500, downloadSpeed: 200 }),
  clearClient: vi.fn(),
  testClient: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/download-clients/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download-clients/transport")>()),
  clearAuthBlocks: vi.fn(),
}))

import {
  clearClient,
  getTorrents,
  getTransferStats,
  testClient,
} from "@/lib/download-clients/rtorrent/transport"
import { clearAuthBlocks } from "@/lib/download-clients/transport"
import { RtorrentClientAdapter } from "../adapters/rtorrent"

function torrent(over: Partial<RtorrentTorrent>): RtorrentTorrent {
  return {
    hash: "ABC",
    name: "Ada.Lovelace.Notes",
    label: "radarr",
    state: 1,
    isActive: true,
    isOpen: true,
    complete: true,
    hashing: 0,
    upRate: 0,
    downRate: 0,
    upTotal: 0,
    downTotal: 100,
    ratio: 0,
    sizeBytes: 100,
    leftBytes: 0,
    completedBytes: 100,
    peersComplete: 0,
    peersAccounted: 0,
    startedAt: 1700000000,
    finishedAt: 1700001000,
    addTime: "",
    directory: "/home/alice/files/Ada.Lovelace.Notes",
    basePath: "",
    isMultiFile: true,
    isPrivate: true,
    trackers: [],
    ...over,
  }
}

const CREDS = {
  authMethod: "password" as const,
  username: "alice",
  password: "p",
  urlPath: "/xmlrpc",
  credentialKey: "password:enc-alice:enc-p",
}

describe("RtorrentClientAdapter", () => {
  let adapter: RtorrentClientAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new RtorrentClientAdapter("seedbox.example.org", 443, true, CREDS)
  })

  it("type is rtorrent", () => {
    expect(adapter.type).toBe("rtorrent")
    expect(adapter.baseUrl).toBe("https://seedbox.example.org:443/xmlrpc")
    expect((adapter as { getDeltaSync?: unknown }).getDeltaSync).toBeUndefined()
  })

  it("category carries the label", async () => {
    vi.mocked(getTorrents).mockResolvedValue([torrent({})])
    const [record] = await adapter.getTorrents()
    expect(record.category).toBe("radarr")
    expect(record.tags).toBe("")
    expect(record.hash).toBe("abc")
  })

  it("tag filter returns nothing", async () => {
    vi.mocked(getTorrents).mockResolvedValue([torrent({ label: "aither" })])
    expect(await adapter.getTorrents({ tag: "aither" })).toEqual([])
  })

  it("active filter keeps moving torrents", async () => {
    vi.mocked(getTorrents).mockResolvedValue([
      torrent({ hash: "UP", upRate: 10 }),
      torrent({ hash: "DOWN", complete: false, downRate: 10 }),
      torrent({ hash: "IDLE" }),
    ])
    const active = await adapter.getTorrents({ filter: "active" })
    expect(active.map((t) => t.hash)).toEqual(["up", "down"])
  })

  it("passes the caller's signal to the transport", async () => {
    vi.mocked(getTorrents).mockResolvedValue([])
    const signal = new AbortController().signal
    await adapter.getTorrents({ signal })
    expect(getTorrents).toHaveBeenCalledWith(adapter.baseUrl, CREDS, { signal })
  })

  it("reads transfer speeds", async () => {
    expect(await adapter.getTransferInfo()).toEqual({ uploadSpeed: 500, downloadSpeed: 200 })
    expect(getTransferStats).toHaveBeenCalledWith(adapter.baseUrl, CREDS)
  })

  it("testConnection clears auth blocks first", async () => {
    await adapter.testConnection()
    expect(clearAuthBlocks).toHaveBeenCalledWith(adapter.baseUrl)
    expect(vi.mocked(clearAuthBlocks).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(testClient).mock.invocationCallOrder[0]
    )
  })

  it("dispose resets the store", () => {
    adapter.dispose()
    expect(clearClient).toHaveBeenCalledWith(adapter.baseUrl)
    expect(clearAuthBlocks).toHaveBeenCalledWith(adapter.baseUrl)
  })
})
