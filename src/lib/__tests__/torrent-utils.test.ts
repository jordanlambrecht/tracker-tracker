// src/lib/__tests__/torrent-utils.test.ts

import { describe, expect, it } from "vitest"
import { formatTorrentRatio } from "@/lib/torrent-utils"

describe("formatTorrentRatio", () => {
  it("formats an ordinary ratio like formatRatio", () => {
    expect(formatTorrentRatio(1.5)).toBe("1.50")
    expect(formatTorrentRatio(0)).toBe("0.00")
  })

  it("renders qBT's -1 infinite-ratio sentinel as infinity", () => {
    // -1 means zero downloads, i.e. a pure cross-seed. Rendered raw it reads
    // as a negative ratio, which is not a thing.
    expect(formatTorrentRatio(-1)).toBe("∞")
  })

  it("renders any negative as infinity, not just -1 exactly", () => {
    expect(formatTorrentRatio(-0.5)).toBe("∞")
  })

  it("passes non-finite values through to the infinity glyph", () => {
    expect(formatTorrentRatio(Number.POSITIVE_INFINITY)).toBe("∞")
    expect(formatTorrentRatio(Number.NaN)).toBe("∞")
  })
})
