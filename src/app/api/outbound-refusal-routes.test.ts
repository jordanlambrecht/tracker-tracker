// src/app/api/outbound-refusal-routes.test.ts
//
// Every route that would contact a tracker, client or service on a user's
// request answers 503 while DISABLE_OUTBOUND_REQUESTS is set, and still answers
// 401 first to a caller who is not signed in.

// @vitest-environment node

import { NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST as clientTest } from "@/app/api/clients/[id]/test/route"
import { GET as clientTorrents } from "@/app/api/clients/[id]/torrents/route"
import { GET as fleetTorrents } from "@/app/api/fleet/torrents/route"
import { POST as notificationTest } from "@/app/api/notifications/[id]/test/route"
import { POST as prowlarrTest } from "@/app/api/prowlarr/[id]/test/route"
import { POST as proxyTest } from "@/app/api/settings/proxy-test/route"
import { POST as trackerDebug } from "@/app/api/trackers/[id]/debug/route"
import {
  GET as mouseholeStatus,
  POST as mouseholeUpdate,
} from "@/app/api/trackers/[id]/mousehole/route"
import { POST as trackerPoll } from "@/app/api/trackers/[id]/poll/route"
import { GET as trackerTorrents } from "@/app/api/trackers/[id]/torrents/route"
import { POST as pollAll } from "@/app/api/trackers/poll-all/route"
import { POST as testConnection } from "@/app/api/trackers/test-connection/route"
import { POST as uploadImage } from "@/app/api/upload-image/route"
import { authenticate, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"

vi.mock("@/lib/api-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-helpers")>()),
  authenticate: vi.fn(),
}))
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

type Handler = (request: Request, context: RouteContext) => Promise<Response>

const ROUTES: [string, Handler][] = [
  ["POST /api/trackers/[id]/poll", trackerPoll],
  ["POST /api/trackers/poll-all", pollAll],
  ["POST /api/trackers/[id]/debug", trackerDebug],
  ["POST /api/trackers/test-connection", testConnection],
  ["GET /api/trackers/[id]/mousehole", mouseholeStatus],
  ["POST /api/trackers/[id]/mousehole", mouseholeUpdate],
  ["GET /api/trackers/[id]/torrents", trackerTorrents],
  ["POST /api/settings/proxy-test", proxyTest],
  ["POST /api/clients/[id]/test", clientTest],
  ["GET /api/clients/[id]/torrents", clientTorrents],
  ["GET /api/fleet/torrents", fleetTorrents],
  ["POST /api/prowlarr/[id]/test", prowlarrTest],
  ["POST /api/notifications/[id]/test", notificationTest],
  ["POST /api/upload-image", uploadImage],
]

function call(handler: Handler): Promise<Response> {
  return handler(new Request("http://localhost/api/route", { method: "POST" }), {
    params: Promise.resolve({ id: "1" }),
  })
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterEach(() => {
  vi.unstubAllEnvs()
  fetchSpy.mockRestore()
})

describe.each(ROUTES)("%s with DISABLE_OUTBOUND_REQUESTS=true", (_name, handler) => {
  it("answers 503 with the shared message and touches nothing", async () => {
    vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "a".repeat(64) })

    const response = await call(handler)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Outbound requests are turned off on this instance (DISABLE_OUTBOUND_REQUESTS)",
    })
    expect(db.select).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("still answers 401 first to a caller who is not signed in", async () => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const response = await call(handler)

    expect(response.status).toBe(401)
  })
})
