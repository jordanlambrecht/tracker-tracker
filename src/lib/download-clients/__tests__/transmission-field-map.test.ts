// src/lib/download-clients/__tests__/transmission-field-map.test.ts

import { describe, expect, it } from "vitest"
import { canonicalTrackerHost, mapTransmissionState, mapTransmissionTorrent } from "../field-map"
import type { TransmissionTorrent, TransmissionTrackerStat } from "../transmission/types"
import { TransmissionStatus } from "../transmission/types"

function stat(over: Partial<TransmissionTrackerStat>): TransmissionTrackerStat {
  return {
    host: "tracker.example.org:443",
    sitename: "example",
    tier: 0,
    id: 0,
    isBackup: false,
    seederCount: 0,
    leecherCount: 0,
    lastAnnounceSucceeded: true,
    ...over,
  }
}

const RAW: TransmissionTorrent = {
  hashString: "abc",
  name: "Test.Release.1080p",
  status: TransmissionStatus.SEED,
  labels: ["aither", "cross-seed"],
  rateUpload: 1024,
  rateDownload: 0,
  uploadedEver: 5000,
  downloadedEver: 2500,
  uploadRatio: 2.0,
  sizeWhenDone: 1_000_000,
  peersSendingToUs: 1,
  peersGettingFromUs: 3,
  addedDate: 1700000000,
  doneDate: 1700001000,
  activityDate: 1700002000,
  secondsSeeding: 86400,
  secondsDownloading: 3600,
  leftUntilDone: 0,
  percentDone: 1.0,
  downloadDir: "/data/completed",
  isPrivate: true,
  trackerStats: [stat({ seederCount: 50, leecherCount: 5 })],
}

describe("mapTransmissionTorrent", () => {
  it("produces a TorrentRecord from a Transmission torrent", () => {
    const r = mapTransmissionTorrent(RAW)
    expect(r.hash).toBe("abc")
    expect(r.uploadSpeed).toBe(1024)
    expect(r.uploaded).toBe(5000)
    expect(r.size).toBe(1_000_000)
    expect(r.seedingTime).toBe(86400)
    expect(r.swarmSeeders).toBe(50)
    expect(r.swarmLeechers).toBe(5)
    expect(r.isPrivate).toBe(true)
  })

  it("joins labels into the comma-separated tag string the rest of the app parses", () => {
    expect(mapTransmissionTorrent(RAW).tags).toBe("aither, cross-seed")
    expect(mapTransmissionTorrent({ ...RAW, labels: [] }).tags).toBe("")
  })

  it("sums seeding and downloading seconds into activeTime", () => {
    expect(mapTransmissionTorrent(RAW).activeTime).toBe(90000)
  })

  it("clamps the -1 ratio Transmission reports when nothing was downloaded", () => {
    // A torrent added at 100% (a cross-seed) never downloads, and Transmission
    // answers -1 rather than 0. Every consumer here treats ratio as >= 0.
    expect(mapTransmissionTorrent({ ...RAW, uploadRatio: -1 }).ratio).toBe(0)
  })

  it("translates 'never completed' from Transmission's 0 to qBittorrent's -1", () => {
    expect(mapTransmissionTorrent({ ...RAW, doneDate: 0 }).completedAt).toBe(-1)
    expect(mapTransmissionTorrent(RAW).completedAt).toBe(1700001000)
  })

  it("builds contentPath without doubling the separator on a trailing slash", () => {
    expect(mapTransmissionTorrent({ ...RAW, downloadDir: "/data/completed/" }).contentPath).toBe(
      "/data/completed/Test.Release.1080p"
    )
  })

  it("never surfaces an announce URL", () => {
    // The passkey lives in `announce`, so the mapper must reach for `host`.
    // Asserted on the serialized record so a future field addition that
    // reintroduces the announce URL fails here.
    const serialized = JSON.stringify(mapTransmissionTorrent(RAW))
    expect(serialized).not.toContain("announce")
    expect(serialized).not.toContain("passkey")
    expect(mapTransmissionTorrent(RAW).tracker).toBe("tracker.example.org:443")
  })

  it("ignores the -1 Transmission uses for a swarm it has never scraped", () => {
    const r = mapTransmissionTorrent({
      ...RAW,
      trackerStats: [stat({ seederCount: -1, leecherCount: -1 })],
    })
    expect(r.swarmSeeders).toBe(0)
    expect(r.swarmLeechers).toBe(0)
  })

  it("survives a torrent with no trackers at all", () => {
    const r = mapTransmissionTorrent({ ...RAW, trackerStats: [] })
    expect(r.tracker).toBe("")
    expect(r.swarmSeeders).toBe(0)
  })
})

describe("canonicalTrackerHost", () => {
  it("prefers announce-list order over the tracker that is currently working", () => {
    // The real TorrentLeech shape, measured on a live client: the site's
    // failover mirror is on a different registrable domain and is the one
    // Transmission has promoted to active (isBackup false). Matching must
    // still resolve the torrent to torrentleech.org, which is the domain the
    // tracker registry and the user both know the site by.
    const host = canonicalTrackerHost([
      stat({
        host: "tracker.torrentleech.org:443",
        sitename: "torrentleech",
        id: 20,
        isBackup: true,
        lastAnnounceSucceeded: false,
      }),
      stat({
        host: "tracker.tleechreload.org:443",
        sitename: "tleechreload",
        id: 21,
        isBackup: false,
        lastAnnounceSucceeded: true,
      }),
    ])
    expect(host).toBe("tracker.torrentleech.org:443")
  })

  it("orders by tier before id", () => {
    const host = canonicalTrackerHost([
      stat({ host: "second.example.org:443", tier: 1, id: 1 }),
      stat({ host: "first.example.org:443", tier: 0, id: 9 }),
    ])
    expect(host).toBe("first.example.org:443")
  })

  it("does not depend on array order", () => {
    const a = stat({ host: "a.example.org:443", tier: 0, id: 0 })
    const b = stat({ host: "b.example.org:443", tier: 0, id: 1 })
    expect(canonicalTrackerHost([a, b])).toBe(canonicalTrackerHost([b, a]))
  })
})

describe("mapTransmissionState", () => {
  const moving = { leftUntilDone: 0, rateUpload: 100, rateDownload: 0 }
  const idle = { leftUntilDone: 0, rateUpload: 0, rateDownload: 0 }
  const incomplete = { leftUntilDone: 500, rateUpload: 0, rateDownload: 0 }

  it("splits seeding on whether bytes are actually moving", () => {
    expect(mapTransmissionState(TransmissionStatus.SEED, moving)).toBe("uploading")
    expect(mapTransmissionState(TransmissionStatus.SEED, idle)).toBe("stalledUP")
  })

  it("splits downloading the same way", () => {
    expect(
      mapTransmissionState(TransmissionStatus.DOWNLOAD, {
        leftUntilDone: 500,
        rateUpload: 0,
        rateDownload: 100,
      })
    ).toBe("downloading")
    expect(mapTransmissionState(TransmissionStatus.DOWNLOAD, incomplete)).toBe("stalledDL")
  })

  it("distinguishes a stopped complete torrent from a stopped incomplete one", () => {
    // pausedUP is in SEEDING_STATES and pausedDL is not, so getting this
    // backwards moves torrents between the seeding and leeching counts.
    expect(mapTransmissionState(TransmissionStatus.STOPPED, idle)).toBe("pausedUP")
    expect(mapTransmissionState(TransmissionStatus.STOPPED, incomplete)).toBe("pausedDL")
  })

  it("maps the queue and verify states", () => {
    expect(mapTransmissionState(TransmissionStatus.SEED_WAIT, idle)).toBe("queuedUP")
    expect(mapTransmissionState(TransmissionStatus.DOWNLOAD_WAIT, incomplete)).toBe("queuedDL")
    expect(mapTransmissionState(TransmissionStatus.CHECK, idle)).toBe("checkingUP")
    expect(mapTransmissionState(TransmissionStatus.CHECK_WAIT, incomplete)).toBe("checkingDL")
  })

  it("falls back to a stalled state for an unknown status code", () => {
    expect(mapTransmissionState(99, idle)).toBe("stalledUP")
    expect(mapTransmissionState(99, incomplete)).toBe("stalledDL")
  })
})
