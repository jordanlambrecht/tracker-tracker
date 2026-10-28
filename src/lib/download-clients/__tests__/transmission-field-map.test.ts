// src/lib/download-clients/__tests__/transmission-field-map.test.ts

import { describe, expect, it } from "vitest"
import { slimTorrentForCache } from "../transforms"
import {
  canonicalTrackerHost,
  mapTransmissionState,
  mapTransmissionTorrent,
} from "../transmission/field-map"
import type { TransmissionTorrent, TransmissionTrackerStat } from "../transmission/types"
import { TransmissionStatus } from "../transmission/types"

function stat(over: Partial<TransmissionTrackerStat>): TransmissionTrackerStat {
  return {
    host: "tracker.example.org:443",
    tier: 0,
    id: 0,
    seederCount: 0,
    leecherCount: 0,
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
    expect(r.ratio).toBe(2)
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

  it("maps Transmission's infinite ratio to the record's -1", () => {
    // -2 is an upload over nothing to seed. The record's -1 is what renders as
    // infinity and stays out of the ratio averages.
    expect(mapTransmissionTorrent({ ...RAW, uploadRatio: -2 }).ratio).toBe(-1)
  })

  it("maps Transmission's not-applicable ratio to 0", () => {
    // -1 is nothing uploaded over nothing to seed, which qBittorrent reports as 0.
    expect(mapTransmissionTorrent({ ...RAW, uploadRatio: -1 }).ratio).toBe(0)
  })

  it("defaults a mistyped number instead of carrying it into the store", () => {
    const r = mapTransmissionTorrent({ ...RAW, uploadedEver: "5000" as unknown as number })
    expect(r.uploaded).toBe(0)
  })

  it("leaves isPrivate out when it is not a boolean", () => {
    const r = mapTransmissionTorrent({ ...RAW, isPrivate: "yes" as unknown as boolean })
    expect(r.isPrivate).toBeUndefined()
  })

  it("defaults activeTime when a seconds field is missing, rather than storing NaN", () => {
    const r = mapTransmissionTorrent({ ...RAW, secondsDownloading: undefined as unknown as number })
    expect(r.activeTime).toBe(0)
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

  it("keeps the passkey out of the record and the cached torrent", () => {
    // Transmission sends announce and scrape in every trackerStats entry, so
    // the fixture carries them the way the parsed response does.
    const passkey = "0123456789abcdef0123456789abcdef"
    const withUrls = {
      ...stat({}),
      announce: `https://tracker.example.org/announce/${passkey}`,
      scrape: `https://tracker.example.org/scrape/${passkey}`,
    } as unknown as TransmissionTrackerStat
    const record = mapTransmissionTorrent({ ...RAW, trackerStats: [withUrls] })

    expect(JSON.stringify(record)).not.toContain(passkey)
    expect(JSON.stringify(slimTorrentForCache(record))).not.toContain(passkey)
    expect(record.tracker).toBe("tracker.example.org:443")
  })

  it("falls back to peers transferring with us when no tracker reported a swarm count", () => {
    // -1 is a tracker Transmission has never scraped.
    const r = mapTransmissionTorrent({
      ...RAW,
      trackerStats: [stat({ seederCount: -1, leecherCount: -1 })],
    })
    expect(r.swarmSeeders).toBe(RAW.peersSendingToUs)
    expect(r.swarmLeechers).toBe(RAW.peersGettingFromUs)
  })

  it("keeps a reported count of 0 instead of falling back", () => {
    const r = mapTransmissionTorrent({
      ...RAW,
      trackerStats: [stat({ seederCount: 0, leecherCount: 0 })],
    })
    expect(r.swarmSeeders).toBe(0)
    expect(r.swarmLeechers).toBe(0)
  })

  it("ignores a swarm count that is not a number", () => {
    const r = mapTransmissionTorrent({
      ...RAW,
      trackerStats: [stat({ seederCount: "50" as unknown as number })],
    })
    expect(r.swarmSeeders).toBe(RAW.peersSendingToUs)
  })

  it("files a torrent whose tracker host is not a string under no tracker", () => {
    const r = mapTransmissionTorrent({
      ...RAW,
      trackerStats: [stat({ host: 42 as unknown as string })],
    })
    expect(r.tracker).toBe("")
  })

  it("survives a torrent with no trackers at all", () => {
    const r = mapTransmissionTorrent({ ...RAW, trackerStats: [] })
    expect(r.tracker).toBe("")
    expect(r.swarmSeeders).toBe(RAW.peersSendingToUs)
  })
})

describe("canonicalTrackerHost", () => {
  it("prefers announce-list order over the tracker that is currently working", () => {
    // A failover mirror on another domain is often the tracker working now.
    // The announce-list head stays the site's own domain.
    const host = canonicalTrackerHost([
      stat({
        host: "tracker.torrentleech.org:443",
        id: 20,
      }),
      stat({
        host: "tracker.tleechreload.org:443",
        id: 21,
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
