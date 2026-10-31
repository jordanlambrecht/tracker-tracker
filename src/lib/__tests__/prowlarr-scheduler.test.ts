// src/lib/__tests__/prowlarr-scheduler.test.ts

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest"
import { pollProwlarrInstance } from "@/lib/prowlarr/sync"
import { requestProwlarrPoll } from "@/lib/prowlarr-scheduler"

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/prowlarr/sync", () => ({ pollProwlarrInstance: vi.fn() }))
vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const KEY = Buffer.alloc(32, 7)

/** Polls that stay running until released, in the order they started. */
function holdPolls() {
  const releases: (() => void)[] = []
  vi.mocked(pollProwlarrInstance).mockImplementation(
    () => new Promise<void>((resolve) => releases.push(resolve))
  )
  return releases
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requestProwlarrPoll", () => {
  it("starts a requested poll of a busy instance only after the running one", async () => {
    const releases = holdPolls()

    const first = requestProwlarrPoll(1, KEY)
    const second = requestProwlarrPoll(1, KEY, { readIndexers: true })
    await flush()
    expect(pollProwlarrInstance).toHaveBeenCalledTimes(1)

    releases[0]()
    await first
    await flush()
    expect(pollProwlarrInstance).toHaveBeenCalledTimes(2)
    expect(vi.mocked(pollProwlarrInstance).mock.calls[1]).toEqual([1, KEY, { readIndexers: true }])

    releases[1]()
    await second
  })

  it("skips a scheduled poll of a busy instance", async () => {
    const releases = holdPolls()

    const running = requestProwlarrPoll(2, KEY)
    const skipped = requestProwlarrPoll(2, KEY, { skipIfBusy: true })
    await flush()
    releases[0]()
    await Promise.all([running, skipped])
    await flush()

    expect(pollProwlarrInstance).toHaveBeenCalledTimes(1)
  })

  it("polls different instances at the same time", async () => {
    const releases = holdPolls()

    const polls = [requestProwlarrPoll(3, KEY), requestProwlarrPoll(4, KEY)]
    await flush()
    expect(pollProwlarrInstance).toHaveBeenCalledTimes(2)

    for (const release of releases) release()
    await Promise.all(polls)
  })

  it("still runs a queued poll after a failed one", async () => {
    vi.mocked(pollProwlarrInstance)
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined)

    const failed = requestProwlarrPoll(5, KEY)
    const next = requestProwlarrPoll(5, KEY)

    await expect(failed).rejects.toThrow("db down")
    await expect(next).resolves.toBeUndefined()
    expect(pollProwlarrInstance).toHaveBeenCalledTimes(2)
  })
})
