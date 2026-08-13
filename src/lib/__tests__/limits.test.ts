// src/lib/__tests__/limits.test.ts
import { describe, expect, it } from "vitest"
import { LARGE_TOKEN_MAX, maxTokenLengthFor, TRACKER_TOKEN_MAX } from "@/lib/limits"

describe("maxTokenLengthFor", () => {
  it.each(["avistaz", "iptorrents", "torrentleech"])(
    "gives %s the large cap for JSON credential blobs",
    (platform) => {
      expect(maxTokenLengthFor(platform)).toBe(LARGE_TOKEN_MAX)
    }
  )

  it.each(["unit3d", "gazelle", "ggn", "mam", "nebulance", "btn"])(
    "keeps %s on the plain-token cap",
    (platform) => {
      expect(maxTokenLengthFor(platform)).toBe(TRACKER_TOKEN_MAX)
    }
  )

  it("falls back to the plain-token cap for null/undefined/unknown platforms", () => {
    expect(maxTokenLengthFor(null)).toBe(TRACKER_TOKEN_MAX)
    expect(maxTokenLengthFor(undefined)).toBe(TRACKER_TOKEN_MAX)
    expect(maxTokenLengthFor("nonexistent")).toBe(TRACKER_TOKEN_MAX)
  })

  // A minimal IPTorrents blob (cf_clearance + uid + pass + UA) lands around
  // 390-480 chars, so it squeaks under the old 500 cap. Once the session also
  // carries remember_web/XSRF cookies it runs past 700. The old cap therefore
  // failed unpredictably depending on the user's cookie set — the large cap
  // removes that cliff.
  const iptBlob = (cookies: string) =>
    JSON.stringify({ cookies, userAgent: `Mozilla/5.0 ${"z".repeat(120)}` })

  it("admits a full IPTorrents session blob that the plain cap would reject", () => {
    const full = iptBlob(
      `cf_clearance=${"x".repeat(250)}; uid=123456; pass=${"y".repeat(32)}; ` +
        `remember_web_59ba36=${"w".repeat(180)}; XSRF-TOKEN=${"v".repeat(40)}`
    )
    expect(full.length).toBeGreaterThan(TRACKER_TOKEN_MAX)
    expect(full.length).toBeLessThanOrEqual(maxTokenLengthFor("iptorrents"))
  })

  it("also admits a minimal blob that happened to fit under the old cap", () => {
    const minimal = iptBlob(`cf_clearance=${"x".repeat(250)}; uid=123456; pass=${"y".repeat(32)}`)
    expect(minimal.length).toBeLessThanOrEqual(maxTokenLengthFor("iptorrents"))
  })
})
