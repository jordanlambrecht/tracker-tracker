// src/lib/__tests__/outbound-switch.test.ts
//
// DISABLE_OUTBOUND_REQUESTS=true must keep a restored copy of a production
// backup from contacting anything: no scheduler starts, no notification goes
// out, and every transport refuses before a request leaves.

// @vitest-environment node

import https from "node:https"
import cron from "node-cron"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import type { NotificationTargetRow } from "@/lib/db/schema"
import { isClientSchedulerRunning, startClientScheduler } from "@/lib/download-client-scheduler"
import { getTransferInfo, login as qbtLogin } from "@/lib/download-clients/qbt/transport"
import { testSession as transmissionTestSession } from "@/lib/download-clients/transmission/transport"
import { imgbbAdapter } from "@/lib/image-hosting/imgbb"
import { onlyimageAdapter } from "@/lib/image-hosting/onlyimage"
import { log } from "@/lib/logger"
import {
  fetchFollowingSafeRedirects,
  isOutboundDisabled,
  logOutboundMode,
  OUTBOUND_DISABLED_ERROR,
} from "@/lib/network"
import { deliverDiscordWebhook, getCircuitState } from "@/lib/notifications/deliver"
import { dispatchNotifications } from "@/lib/notifications/dispatch"
import type { SnapshotContext } from "@/lib/notifications/types"
import { fetchSystemStatus } from "@/lib/prowlarr/client"
import { pollProwlarrInstance } from "@/lib/prowlarr/sync"
import {
  isProwlarrSchedulerRunning,
  requestProwlarrPoll,
  startProwlarrScheduler,
  stopProwlarrScheduler,
} from "@/lib/prowlarr-scheduler"
import { adapterFetch } from "@/lib/tracker-platforms/helpers/adapter-fetch"
import { fetchTrackerHtml } from "@/lib/tracker-platforms/helpers/html-fetch"
import { loginRequest } from "@/lib/tracker-platforms/helpers/login-session"
import { isTrackerPollingRunning, startTrackerPolling } from "@/lib/tracker-scheduler"
import { proxyFetch } from "@/lib/tunnel"

vi.mock("node-cron", () => ({ default: { schedule: vi.fn(() => ({ stop: vi.fn() })) } }))
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/prowlarr/sync", () => ({ pollProwlarrInstance: vi.fn(async () => {}) }))

const KEY = Buffer.alloc(32, 7)

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))
})

afterEach(() => {
  vi.unstubAllEnvs()
  fetchSpy.mockRestore()
})

describe("isOutboundDisabled", () => {
  it("is off when the variable is unset", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", undefined)
    expect(isOutboundDisabled()).toBe(false)
  })

  it.each(["true", "1", "TRUE", "yes", " True "])("is on for %j", (value) => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", value)
    expect(isOutboundDisabled()).toBe(true)
  })

  it.each(["false", "0", "no", " FALSE ", ""])("is off for the explicit off value %j", (value) => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", value)
    expect(isOutboundDisabled()).toBe(false)
  })

  it("fails closed on a value it does not recognise", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "ture")
    expect(isOutboundDisabled()).toBe(true)
  })

  it("is read on every call, so a restore or login after boot still sees it", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", undefined)
    expect(isOutboundDisabled()).toBe(false)
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
    expect(isOutboundDisabled()).toBe(true)
  })
})

describe("logOutboundMode", () => {
  it("logs the off mode as info when the variable is unset", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", undefined)
    logOutboundMode()
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })

  it("warns once for a recognised on value", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "yes")
    logOutboundMode()
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.error).not.toHaveBeenCalled()
  })

  it("logs an error for an unrecognised value, and still warns that requests are off", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "ture")
    logOutboundMode()
    expect(log.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(log.error).mock.calls[0][0]).toContain('"ture"')
    expect(log.warn).toHaveBeenCalledTimes(1)
  })
})

describe("scheduler starts with DISABLE_OUTBOUND_REQUESTS=true", () => {
  beforeEach(() => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
  })

  it("startTrackerPolling schedules nothing and runs no initial poll", () => {
    startTrackerPolling(KEY)
    expect(cron.schedule).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
    expect(isTrackerPollingRunning()).toBe(false)
  })

  it("startClientScheduler schedules nothing and runs no initial heartbeat", () => {
    startClientScheduler(KEY)
    expect(cron.schedule).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
    expect(isClientSchedulerRunning()).toBe(false)
  })

  it("startProwlarrScheduler schedules nothing and runs no initial cycle", () => {
    startProwlarrScheduler(KEY)
    expect(cron.schedule).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
    expect(isProwlarrSchedulerRunning()).toBe(false)
  })

  it("requestProwlarrPoll resolves without polling, so a saved instance records no failure", async () => {
    await requestProwlarrPoll(1, KEY, { readIndexers: true })
    expect(pollProwlarrInstance).not.toHaveBeenCalled()
  })
})

describe("scheduler starts with the variable unset", () => {
  beforeEach(() => {
    stopProwlarrScheduler()
  })

  afterEach(() => {
    stopProwlarrScheduler()
  })

  it("startProwlarrScheduler still schedules its cycle", () => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", undefined)
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: async () => [] }),
    } as never)
    startProwlarrScheduler(KEY)
    expect(cron.schedule).toHaveBeenCalledTimes(1)
    expect(isProwlarrSchedulerRunning()).toBe(true)
  })
})

describe("notifications with DISABLE_OUTBOUND_REQUESTS=true", () => {
  beforeEach(() => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
  })

  it("dispatchNotifications sends nothing and writes nothing", async () => {
    const target = { id: 1, enabled: true } as NotificationTargetRow
    await dispatchNotifications({ trackerId: 1 } as SnapshotContext, KEY, [target])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("deliverDiscordWebhook refuses without a request and without tripping the breaker", async () => {
    const result = await deliverDiscordWebhook(42, "https://discord.com/api/webhooks/1/x", [])
    expect(result).toEqual({ success: false, status: "failed", error: OUTBOUND_DISABLED_ERROR })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getCircuitState(42).failures).toBe(0)
  })
})

describe("transports with DISABLE_OUTBOUND_REQUESTS=true", () => {
  beforeEach(() => {
    vi.stubEnv("DISABLE_OUTBOUND_REQUESTS", "true")
  })

  it("adapterFetch refuses before fetch", async () => {
    await expect(
      adapterFetch("https://tracker.example/api/user", "tracker.example")
    ).rejects.toThrow(OUTBOUND_DISABLED_ERROR)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fetchFollowingSafeRedirects refuses before fetch", async () => {
    await expect(
      fetchFollowingSafeRedirects("https://tracker.example/avatar.png", AbortSignal.timeout(1000))
    ).rejects.toThrow(OUTBOUND_DISABLED_ERROR)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("proxyFetch refuses before opening a request", async () => {
    const requestSpy = vi.spyOn(https, "request")
    try {
      await expect(
        proxyFetch("https://tracker.example/api/user", new https.Agent())
      ).rejects.toThrow(OUTBOUND_DISABLED_ERROR)
      expect(requestSpy).not.toHaveBeenCalled()
    } finally {
      requestSpy.mockRestore()
    }
  })

  const transmissionCreds = {
    authMethod: "password",
    username: "user",
    password: "secret",
    urlPath: "/transmission/rpc",
    credentialKey: "transmission-key",
  } as const
  const image = Buffer.from("png")

  it.each<[string, () => Promise<unknown>]>([
    [
      "fetchTrackerHtml",
      () =>
        fetchTrackerHtml({
          url: "https://tracker.example/index.php",
          cookies: "session=abc",
          label: "Example",
          sessionExpiredMessage: "Session expired",
        }),
    ],
    [
      "loginRequest",
      () =>
        loginRequest("https://tracker.example/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "username=user",
        }),
    ],
    [
      "qbt login",
      () => qbtLogin("qbt.example", 8080, false, "user", "secret", "", "qbt-login-key"),
    ],
    [
      "qbt request",
      () =>
        getTransferInfo("http://qbt.example:8080", {
          mode: "apikey",
          key: "qbt-api-key",
          credentialKey: "qbt-request-key",
        }),
    ],
    [
      "transmission RPC",
      () => transmissionTestSession("http://transmission.example:9091", transmissionCreds),
    ],
    [
      "Prowlarr",
      () => fetchSystemStatus({ url: "http://prowlarr.example:9696", apiKey: "abc123" }),
    ],
    ["imgbb", () => imgbbAdapter.upload(image, "a.png", "imgbb-key")],
    ["onlyimage", () => onlyimageAdapter.upload(image, "a.png", "onlyimage-key")],
  ])("%s refuses before fetch", async (_name, call) => {
    await expect(call()).rejects.toThrow(OUTBOUND_DISABLED_ERROR)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
