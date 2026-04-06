// src/lib/__tests__/client-scheduler-projections.test.ts
//
// Functions: (test file)

import { describe, expect, it, vi } from "vitest"

// Must be declared before any imports that transitively load @/lib/db,
// otherwise the module-level connection string check throws.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}))

vi.mock("@/lib/download-clients", () => ({
  aggregateByTag: vi.fn(),
  clearAllSessions: vi.fn(),
  clearSpeedCache: vi.fn(),
  getTorrents: vi.fn(),
  getTransferInfo: vi.fn(),
  parseCrossSeedTags: vi.fn(() => []),
  pushSpeedSnapshot: vi.fn(),
  slimTorrentForCache: vi.fn((t: unknown) => t),
  stripSensitiveTorrentFields: vi.fn((t: unknown) => t),
  withSessionRetry: vi.fn(),
}))

vi.mock("@/lib/uptime", () => ({
  clearUptimeAccumulator: vi.fn(),
  flushCompletedBuckets: vi.fn(),
  recordHeartbeat: vi.fn(),
}))

import { DEEP_POLL_COLUMNS, HEARTBEAT_COLUMNS } from "@/lib/download-client-scheduler"

type HeartbeatRequiredFields = {
  id: number
  enabled: boolean
  name: string
  host: string
  port: number
  useSsl: boolean
  encryptedUsername: string
  encryptedPassword: string
}

type DeepPollRequiredFields = HeartbeatRequiredFields & {
  crossSeedTags: string[] | null
  pollIntervalSeconds: number
  lastPolledAt: Date | null
}

describe("client-scheduler column projections", () => {
  it("HEARTBEAT_COLUMNS covers all fields heartbeatClient accesses", () => {
    const keys = Object.keys(HEARTBEAT_COLUMNS)
    const required: (keyof HeartbeatRequiredFields)[] = [
      "id",
      "enabled",
      "name",
      "host",
      "port",
      "useSsl",
      "encryptedUsername",
      "encryptedPassword",
    ]
    for (const key of required) {
      expect(keys).toContain(key)
    }
  })

  it("DEEP_POLL_COLUMNS covers all fields deepPollClient accesses", () => {
    const keys = Object.keys(DEEP_POLL_COLUMNS)
    const required: (keyof DeepPollRequiredFields)[] = [
      "id",
      "enabled",
      "name",
      "host",
      "port",
      "useSsl",
      "encryptedUsername",
      "encryptedPassword",
      "crossSeedTags",
      "pollIntervalSeconds",
      "lastPolledAt",
    ]
    for (const key of required) {
      expect(keys).toContain(key)
    }
  })

  it("HEARTBEAT_COLUMNS does NOT include cachedTorrents", () => {
    expect(Object.keys(HEARTBEAT_COLUMNS)).not.toContain("cachedTorrents")
  })

  it("DEEP_POLL_COLUMNS does NOT include cachedTorrents", () => {
    expect(Object.keys(DEEP_POLL_COLUMNS)).not.toContain("cachedTorrents")
  })
})
