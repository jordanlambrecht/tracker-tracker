// src/lib/__tests__/events.test.ts

import { describe, expect, it } from "vitest"
import {
  backupToEvent,
  mergeAndSort,
  parseLogLine,
  type SystemEvent,
  snapshotToEvent,
} from "@/lib/events"

describe("parseLogLine", () => {
  it("parses a valid Pino NDJSON info line", () => {
    const line = JSON.stringify({
      level: 30,
      time: 1711100000000,
      msg: "polling toggled",
      route: "PATCH /api/trackers/[id]",
      trackerId: 5,
      action: "paused",
    })
    const event = parseLogLine(line)
    expect(event).not.toBeNull()
    expect(event?.category).toBe("settings")
    expect(event?.level).toBe("info")
    expect(event?.title).toBe("polling toggled")
    expect(event?.detail).toContain("paused")
  })

  it("returns null for unparseable lines", () => {
    expect(parseLogLine("not json")).toBeNull()
    expect(parseLogLine("")).toBeNull()
  })

  it("redacts IP addresses from log messages", () => {
    const line = JSON.stringify({
      level: 30,
      time: 1711100000000,
      msg: "login attempt",
      event: "login_failed",
      ip: "192.168.1.42",
    })
    const event = parseLogLine(line)
    expect(event).not.toBeNull()
    expect(event?.detail).not.toContain("192.168.1.42")
    expect(event?.detail).toContain("[redacted]")
  })

  it("sanitizes raw error messages in log lines", () => {
    const line = JSON.stringify({
      level: 50,
      time: 1711100000000,
      msg: "Poll failed for tracker 3: ECONNREFUSED 10.0.0.5:443",
    })
    const event = parseLogLine(line)
    expect(event).not.toBeNull()
    expect(event?.detail).not.toContain("10.0.0.5")
  })

  it("classifies auth events by event field", () => {
    const line = JSON.stringify({
      level: 30,
      time: 1711100000000,
      msg: "login successful",
      event: "login_success",
      ip: "1.2.3.4",
    })
    const event = parseLogLine(line)
    expect(event?.category).toBe("auth")
  })

  it("classifies poll failures as errors category", () => {
    const line = JSON.stringify({
      level: 50,
      time: 1711100000000,
      msg: "Poll failed for tracker 7: timeout",
      trackerId: 7,
    })
    const event = parseLogLine(line)
    expect(event?.category).toBe("errors")
    expect(event?.level).toBe("error")
  })
})

describe("snapshotToEvent", () => {
  it("converts a tracker snapshot to a poll event", () => {
    const event = snapshotToEvent({
      id: 1,
      polledAt: "2026-03-22T14:00:00.000Z",
      uploadedBytes: "1073741824",
      downloadedBytes: "536870912",
      ratio: 2.0,
      trackerId: 5,
      trackerName: "RED",
    })
    expect(event.category).toBe("polls")
    expect(event.level).toBe("info")
    expect(event.title).toBe("Poll succeeded")
    expect(event.trackerName).toBe("RED")
    expect(event.source).toBe("db")
  })
})

describe("backupToEvent", () => {
  it("converts a backup history record to a backup event", () => {
    const event = backupToEvent({
      id: 10,
      createdAt: "2026-03-22T03:00:00.000Z",
      sizeBytes: 524288,
      encrypted: true,
      status: "completed",
      frequency: "daily",
    })
    expect(event.category).toBe("backups")
    expect(event.level).toBe("info")
    expect(event.title).toBe("Backup completed")
    expect(event.detail).toContain("512")
  })

  it("marks failed backups as error level", () => {
    const event = backupToEvent({
      id: 11,
      createdAt: "2026-03-22T03:00:00.000Z",
      sizeBytes: 0,
      encrypted: false,
      status: "failed",
      frequency: "daily",
    })
    expect(event.level).toBe("error")
  })
})

describe("mergeAndSort", () => {
  it("merges DB and log events in reverse chronological order", () => {
    const dbEvents: SystemEvent[] = [
      {
        id: "db-1",
        timestamp: "2026-03-22T14:00:00Z",
        category: "polls",
        level: "info",
        title: "Poll",
        detail: null,
        trackerId: 1,
        trackerName: "RED",
        source: "db",
      },
    ]
    const logEvents: SystemEvent[] = [
      {
        id: "log-1",
        timestamp: "2026-03-22T15:00:00Z",
        category: "auth",
        level: "info",
        title: "Login",
        detail: null,
        trackerId: null,
        trackerName: null,
        source: "log",
      },
      {
        id: "log-2",
        timestamp: "2026-03-22T13:00:00Z",
        category: "settings",
        level: "info",
        title: "Changed",
        detail: null,
        trackerId: null,
        trackerName: null,
        source: "log",
      },
    ]
    const merged = mergeAndSort(dbEvents, logEvents)
    expect(merged[0].id).toBe("log-1") // 15:00 first
    expect(merged[1].id).toBe("db-1") // 14:00 second
    expect(merged[2].id).toBe("log-2") // 13:00 third
  })

  it("applies category filter", () => {
    const events: SystemEvent[] = [
      {
        id: "1",
        timestamp: "2026-03-22T14:00:00Z",
        category: "polls",
        level: "info",
        title: "Poll",
        detail: null,
        trackerId: 1,
        trackerName: null,
        source: "db",
      },
      {
        id: "2",
        timestamp: "2026-03-22T13:00:00Z",
        category: "auth",
        level: "info",
        title: "Login",
        detail: null,
        trackerId: null,
        trackerName: null,
        source: "log",
      },
    ]
    const filtered = mergeAndSort([], events, "auth")
    expect(filtered).toHaveLength(1)
    expect(filtered[0].category).toBe("auth")
  })

  it("applies pagination", () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      id: `e-${i}`,
      timestamp: new Date(2026, 2, 22, i).toISOString(),
      category: "polls" as const,
      level: "info" as const,
      title: `Event ${i}`,
      detail: null,
      trackerId: null,
      trackerName: null,
      source: "db" as const,
    }))
    const page = mergeAndSort(events, [], "all", 3, 2)
    expect(page).toHaveLength(3)
    // Reverse chronological: index 9,8,7,6,5... offset 2 → starts at 7
    expect(page[0].title).toBe("Event 7")
  })
})
