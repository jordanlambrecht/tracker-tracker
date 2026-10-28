// src/lib/tracker-platforms/__tests__/fetch-raw-parity.test.ts
//
// DebugResponseDialog marks a call healthy only when `error` is null, so a
// failure inside an HTTP 200 body must surface in `error`.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DigitalCoreAdapter } from "../adapters/digitalcore"
import { GazelleAdapter } from "../adapters/gazelle"
import { GGnAdapter } from "../adapters/ggn"
import { HawkeAdapter } from "../adapters/hawke"
import { MamAdapter } from "../adapters/mam"
import { NebulanceAdapter } from "../adapters/nebulance"
import { Unit3dAdapter } from "../adapters/unit3d"
import type { TrackerAdapter } from "../contract"

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

  /** Each body in turn as an HTTP 200. A request past them is refused, never sent. */
  function respond(bodies: unknown[]) {
    const spy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("no response queued"))
    for (const body of bodies) {
      spy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as Response)
    }
  }

  const QUICK_USER = { status: "success", response: { id: 70813, username: "lanternfoxtail" } }

  // A body fetchStats rejects fails its debug call with the poll's own message,
  // and stays in data so the dialog can print it under that message.
  const parity: {
    name: string
    adapter: TrackerAdapter
    args: [baseUrl: string, apiToken: string, apiPath: string]
    bodies: unknown[]
    call: number
  }[] = [
    {
      name: "UNIT3D, an auth message in place of the user",
      adapter: new Unit3dAdapter(),
      args: ["https://aither.cc", "fake-token", "/api/user"],
      bodies: [{ message: "Unauthenticated." }],
      call: 0,
    },
    {
      name: "DigitalCore, a status with no user",
      adapter: new DigitalCoreAdapter(),
      args: ["https://digitalcore.club", JSON.stringify({ uid: "54321", pass: "abc123xyz" }), ""],
      bodies: [{ user: null }],
      call: 0,
    },
    {
      name: "DigitalCore, a status user with no byte totals",
      adapter: new DigitalCoreAdapter(),
      args: ["https://digitalcore.club", JSON.stringify({ uid: "54321", pass: "abc123xyz" }), ""],
      bodies: [{ user: { id: 54321, username: "dcuser" } }],
      call: 0,
    },
    {
      name: "GGn, a quick_user success with no id",
      adapter: new GGnAdapter(),
      args: ["https://gazellegames.net", "fake-token", "/api.php"],
      bodies: [{ status: "success", response: {} }],
      call: 0,
    },
    {
      name: "GGn, a user call with no stats",
      adapter: new GGnAdapter(),
      args: ["https://gazellegames.net", "fake-token", "/api.php"],
      bodies: [
        QUICK_USER,
        { status: "success", response: { id: 70813, username: "lanternfoxtail" } },
      ],
      call: 1,
    },
    {
      name: "GGn, user stats with no byte totals",
      adapter: new GGnAdapter(),
      args: ["https://gazellegames.net", "fake-token", "/api.php"],
      bodies: [
        QUICK_USER,
        { status: "success", response: { id: 70813, username: "lanternfoxtail", stats: {} } },
      ],
      call: 1,
    },
    {
      name: "Gazelle, an index with no userstats",
      adapter: new GazelleAdapter(),
      args: ["https://redacted.sh", "fake-token", "/ajax.php"],
      // No id, so fetchRaw skips the profile call rather than pausing for it.
      bodies: [{ status: "success", response: { username: "JohnDoe" } }],
      call: 0,
    },
    {
      name: "Gazelle, userstats with no byte totals",
      adapter: new GazelleAdapter(),
      args: ["https://redacted.sh", "fake-token", "/ajax.php"],
      bodies: [{ status: "success", response: { username: "JohnDoe", userstats: {} } }],
      call: 0,
    },
    {
      name: "Hawke, a success envelope with no data",
      adapter: new HawkeAdapter(),
      args: ["https://hawke.uno", "fake-token", "/api/profile"],
      bodies: [{ success: true }],
      call: 0,
    },
    {
      name: "Hawke, a profile with no byte totals",
      adapter: new HawkeAdapter(),
      args: ["https://hawke.uno", "fake-token", "/api/profile"],
      bodies: [{ success: true, data: { username: "MapleCanary" } }],
      call: 0,
    },
    {
      name: "MAM, a username with no byte totals",
      adapter: new MamAdapter(),
      args: ["https://myanonamouse.net", "abc123abc123abc123abc123abc123ab", "/jsonLoad.php"],
      bodies: [{ username: "trackerfan" }],
      call: 0,
    },
    {
      name: "Nebulance, a success wrapper with no user",
      adapter: new NebulanceAdapter(),
      args: ["https://nebulance.io", "fake-token", "/api.php"],
      bodies: [{ status: "success", response: {} }],
      call: 0,
    },
  ]

  for (const { name, adapter, args, bodies, call } of parity) {
    it(`${name} fails the debug call with the message the poll fails with`, async () => {
      respond(bodies)
      const pollFailure = await adapter
        .fetchStats(...args)
        .then(() => null)
        .catch((e: unknown) => (e instanceof Error ? e : null))
      expect(pollFailure).not.toBeNull()

      vi.restoreAllMocks()
      respond(bodies)
      const calls = await adapter.fetchRaw(...args)

      expect(calls[call].error).toBe(pollFailure?.message)
      expect(calls[call].data).toEqual(bodies[call])
    })
  }
})
