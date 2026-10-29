// src/lib/download-clients/__tests__/transmission-field-map.test.ts

import { describe, expect, it } from "vitest"
import { LEECHING_STATES, SEEDING_STATES } from "@/lib/fleet"
import { slimTorrentForCache } from "../transforms"
import {
  announceHost,
  canonicalTrackerHost,
  mapTransmissionState,
  mapTransmissionTorrent,
} from "../transmission/field-map"
import type { TransmissionTorrent, TransmissionTracker } from "../transmission/types"
import { TransmissionStatus } from "../transmission/types"

function tracker(over: Partial<TransmissionTracker>): TransmissionTracker {
  return { announce: "https://tracker.example.org/announce", tier: 0, id: 0, ...over }
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
  trackers: [tracker({})],
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
    expect(r.tracker).toBe("tracker.example.org")
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
    // Transmission sends announce and scrape in every trackers entry, so the
    // fixture carries both the way the parsed response does.
    const passkey = "0123456789abcdef0123456789abcdef"
    const withUrls = {
      ...tracker({ announce: `https://tracker.example.org/announce/${passkey}` }),
      scrape: `https://tracker.example.org/scrape/${passkey}`,
    } as TransmissionTracker
    const record = mapTransmissionTorrent({ ...RAW, trackers: [withUrls] })

    expect(JSON.stringify(record)).not.toContain(passkey)
    expect(JSON.stringify(slimTorrentForCache(record))).not.toContain(passkey)
    expect(record.tracker).toBe("tracker.example.org")
  })

  it("counts the peers transferring with us as the swarm, since trackers has no counts", () => {
    const r = mapTransmissionTorrent(RAW)
    expect(r.swarmSeeders).toBe(RAW.peersSendingToUs)
    expect(r.swarmLeechers).toBe(RAW.peersGettingFromUs)
  })

  it("files a torrent whose announce is not a string under no tracker", () => {
    const r = mapTransmissionTorrent({
      ...RAW,
      trackers: [tracker({ announce: 42 as unknown as string })],
    })
    expect(r.tracker).toBe("")
  })

  it("survives a torrent with no trackers at all", () => {
    expect(mapTransmissionTorrent({ ...RAW, trackers: [] }).tracker).toBe("")
  })
})

describe("announceHost", () => {
  // A passkey can sit in the path, the query or the userinfo. None of them is a host.
  it.each([
    ["a path passkey", "https://tracker.example.org/announce/abc123", "tracker.example.org"],
    [
      "a query passkey",
      "http://tracker.example.org:6969/a?passkey=abc123",
      "tracker.example.org:6969",
    ],
    ["userinfo", "http://user:secret@tracker.example.org/announce", "tracker.example.org"],
    ["a udp tracker", "udp://open.example.org:1337/announce", "open.example.org:1337"],
    ["an uppercase host", "https://Tracker.Example.ORG/announce", "tracker.example.org"],
    // udp:// keeps its case, unlike http, https and wss. trackerHostKey lowers it when matching.
    ["an uppercase udp host", "udp://Open.Example.ORG:1337/announce", "Open.Example.ORG:1337"],
    ["an IPv6 host", "http://[2001:db8::1]:6969/announce", "[2001:db8::1]:6969"],
    ["a malformed URL", "not a url", ""],
    ["an empty string", "", ""],
  ])("reduces %s to its host", (_case, announce, host) => {
    expect(announceHost(announce)).toBe(host)
  })

  it("gives no host for a value that is not a string", () => {
    expect(announceHost(undefined)).toBe("")
  })
})

describe("canonicalTrackerHost", () => {
  it("prefers announce-list order over the tracker that is currently working", () => {
    // A failover mirror on another domain is often the tracker working now.
    // The announce-list head stays the site's own domain.
    const host = canonicalTrackerHost([
      tracker({ announce: "https://tracker.torrentleech.org/a/key", id: 20 }),
      tracker({ announce: "https://tracker.tleechreload.org/a/key", id: 21 }),
    ])
    expect(host).toBe("tracker.torrentleech.org")
  })

  it("orders by tier before id", () => {
    const host = canonicalTrackerHost([
      tracker({ announce: "https://second.example.org/announce", tier: 1, id: 1 }),
      tracker({ announce: "https://first.example.org/announce", tier: 0, id: 9 }),
    ])
    expect(host).toBe("first.example.org")
  })

  it("does not depend on array order", () => {
    const a = tracker({ announce: "https://a.example.org/announce", tier: 0, id: 0 })
    const b = tracker({ announce: "https://b.example.org/announce", tier: 0, id: 1 })
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

  it("names a stopped torrent the way qBittorrent 5 does", () => {
    expect(mapTransmissionState(TransmissionStatus.STOPPED, idle)).toBe("stoppedUP")
    expect(mapTransmissionState(TransmissionStatus.STOPPED, incomplete)).toBe("stoppedDL")
  })

  it("maps the queue and verify states", () => {
    expect(mapTransmissionState(TransmissionStatus.SEED_WAIT, idle)).toBe("queuedUP")
    expect(mapTransmissionState(TransmissionStatus.DOWNLOAD_WAIT, incomplete)).toBe("queuedDL")
    expect(mapTransmissionState(TransmissionStatus.CHECK, idle)).toBe("checkingUP")
    expect(mapTransmissionState(TransmissionStatus.CHECK_WAIT, incomplete)).toBe("checkingDL")
  })

  it("names an unknown status code unknown", () => {
    expect(mapTransmissionState(99, idle)).toBe("unknown")
    expect(mapTransmissionState(99, incomplete)).toBe("unknown")
  })

  // Only downloading and seeding count as active, stalled ones included. A
  // stopped, queued or verifying torrent still counts toward size and totals.
  it("counts only DOWNLOAD and SEED as seeding or leeching", () => {
    const isActive = (status: number) =>
      [moving, idle, incomplete].map((t) => {
        const state = mapTransmissionState(status, t)
        return SEEDING_STATES.has(state) || LEECHING_STATES.has(state)
      })

    for (const status of [TransmissionStatus.DOWNLOAD, TransmissionStatus.SEED]) {
      expect(isActive(status)).toEqual([true, true, true])
    }
    for (const status of [
      TransmissionStatus.STOPPED,
      TransmissionStatus.CHECK_WAIT,
      TransmissionStatus.CHECK,
      TransmissionStatus.DOWNLOAD_WAIT,
      TransmissionStatus.SEED_WAIT,
      99,
    ]) {
      expect(isActive(status)).toEqual([false, false, false])
    }
  })
})
