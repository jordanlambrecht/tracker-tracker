// src/lib/tracker-platforms/__tests__/envelope.test.ts
//
// DebugResponseDialog marks a call healthy only when `error` is null, so a
// failure inside an HTTP 200 body must surface in `error`.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { GazelleAdapter } from "../adapters/gazelle"
import { GGnAdapter } from "../adapters/ggn"
import { HawkeAdapter } from "../adapters/hawke"
import { MamAdapter } from "../adapters/mam"
import { envelopeError } from "../helpers/envelope"

describe("envelopeError", () => {
  it("reads the Gazelle-family status envelope", () => {
    expect(envelopeError({ status: "success", response: {} })).toBeNull()
    expect(envelopeError({ status: "failure", error: "bad key" })).toBe("bad key")
    expect(envelopeError({ status: "failure" })).toBe("Tracker returned status: failure")
  })

  it("reads the Hawke-family success envelope", () => {
    expect(envelopeError({ success: true, data: {} })).toBeNull()
    expect(envelopeError({ success: false, message: "invalid token" })).toBe("invalid token")
    expect(envelopeError({ success: false })).toBe("Tracker reported a failure with no message")
  })

  it("treats a body carrying neither flag as no signal rather than a failure", () => {
    expect(envelopeError({ username: "someone" })).toBeNull()
    expect(envelopeError(null)).toBeNull()
    expect(envelopeError("nope")).toBeNull()
    expect(envelopeError({ status: 200 })).toBeNull()
  })

  it("does not mistake a blank reason for a missing envelope", () => {
    expect(envelopeError({ status: "failure", error: "   " })).toBe(
      "Tracker returned status: failure"
    )
  })
})

describe("fetchRaw reports a failure carried in a 200 body", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const cases = [
    {
      name: "Gazelle",
      body: { status: "failure", error: "invalid api key" },
      run: () => new GazelleAdapter().fetchRaw("https://redacted.sh", "fake-token", "/ajax.php"),
      expected: "invalid api key",
    },
    {
      name: "GGn",
      body: { status: "failure", error: "bad credentials" },
      run: () => new GGnAdapter().fetchRaw("https://gazellegames.net", "fake-token", "/api.php"),
      expected: "bad credentials",
    },
    {
      name: "Hawke",
      body: { success: false, message: "token rejected" },
      run: () => new HawkeAdapter().fetchRaw("https://hawke.uno", "fake-token", "/api/profile"),
      expected: "token rejected",
    },
    {
      name: "MAM",
      body: { uploaded_bytes: 1, downloaded_bytes: 1 },
      run: () =>
        new MamAdapter().fetchRaw(
          "https://myanonamouse.net",
          "abc123abc123abc123abc123abc123ab",
          "/jsonLoad.php"
        ),
      expected: "missing username",
    },
  ] as const

  for (const { name, body, run, expected } of cases) {
    it(`${name} marks the call as failed rather than healthy`, async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      } as Response)

      const calls = await run()

      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0].error).toBeTruthy()
      expect(String(calls[0].error)).toContain(expected)
    })
  }
})
