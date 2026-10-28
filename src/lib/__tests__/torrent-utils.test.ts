// src/lib/__tests__/torrent-utils.test.ts

import { describe, expect, it } from "vitest"
import { formatTorrentRatio, isInfiniteTorrentRatio, torrentRatioValue } from "@/lib/torrent-utils"

describe("torrentRatioValue", () => {
  it("reads only the -1 sentinel as infinite", () => {
    // 9999 is qBittorrent's cap before 5.1.1, a finite ratio.
    const sent = [-1, 0, 0.5, 9999]
    expect(sent.map(isInfiniteTorrentRatio)).toEqual([true, false, false, false])
    expect(sent.map(torrentRatioValue)).toEqual([Number.POSITIVE_INFINITY, 0, 0.5, 9999])
  })
})

describe("formatTorrentRatio", () => {
  it("formats an ordinary ratio like formatRatio", () => {
    expect(formatTorrentRatio(1.5)).toBe("1.50")
    expect(formatTorrentRatio(0)).toBe("0.00")
  })

  it("renders qBT's -1 infinite-ratio sentinel as infinity", () => {
    // -1 is qBT's infinite ratio. Rendered raw it reads as a negative ratio,
    // which is not a thing.
    expect(formatTorrentRatio(-1)).toBe("∞")
  })

  it("passes non-finite values through to the infinity glyph", () => {
    expect(formatTorrentRatio(Number.POSITIVE_INFINITY)).toBe("∞")
    expect(formatTorrentRatio(Number.NaN)).toBe("∞")
  })
})
