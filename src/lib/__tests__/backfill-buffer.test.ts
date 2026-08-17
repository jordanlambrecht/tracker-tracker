// src/lib/__tests__/backfill-buffer.test.ts
//
// Covers the pure logic behind the signed-buffer backfill CLI,
// scripts/backfill-buffer.cjs — row selection, the repair value, the
// per-platform classification and the summary — with no database anywhere near
// it.
//
// It loads the SHIPPED ARTIFACT rather than a TypeScript copy, the same way
// reset-password.test.ts does for recover.cjs: the file that runs inside the
// production image is the file under test, so a "fixed" copy that never shipped
// cannot pass here.
//
// Two of these blocks are drift-catchers rather than behaviour tests. The schema
// parity block asserts the CLI's hardcoded table and column names against the
// live Drizzle schema, because a rename would otherwise turn the backfill into a
// silent no-op or an error only discovered mid-incident. The connection-string
// block asserts that the copy of buildConnectionString() agrees with
// recover.cjs's original, since the duplication is deliberate.
//
// createRequire is used instead of a bare import so Node loads the CommonJS file
// as-is, with no bundler transform between the test and the file that ships.

import { createRequire } from "node:module"
import { getTableColumns, getTableName } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"
import * as schema from "@/lib/db/schema"

const require = createRequire(import.meta.url)
const backfill = require("../../../scripts/backfill-buffer.cjs")
const recover = require("../../../scripts/recover.cjs")

const {
  BUCKET_AMBIGUOUS,
  BUCKET_ESTIMATE,
  BUCKET_EXACT,
  BUCKET_NEVER_CLAMPED,
  BUCKET_UNKNOWN,
  BUFFER_TABLES,
  PLATFORM_BUCKETS,
  SKIP_REASONS,
  buildConnectionString,
  classifyPlatform,
  formatSignedBytes,
  isClampedRow,
  isRepairable,
  parseArgs,
  repairedBufferBytes,
  summarize,
  toDateKey,
  totalRows,
} = backfill

/** postgres.js returns int8 columns as strings; that is the shape under test. */
function row(buffer: string | null, uploaded: string, downloaded: string) {
  return { buffer, uploaded, downloaded }
}

describe("isClampedRow", () => {
  it("selects a row the clamp fired on: zero buffer while in deficit", () => {
    expect(isClampedRow(row("0", "100", "500"))).toBe(true)
  })

  it("rejects a NULL buffer — unmeasured, no clamp ran", () => {
    // This is the one that matters most: `buffer_bytes` is nullable and today.ts
    // reads a NULL as 0n, so a careless predicate would sweep every unmeasured
    // row into the rewrite.
    expect(isClampedRow(row(null, "100", "500"))).toBe(false)
    expect(isClampedRow({ buffer: undefined, uploaded: "100", downloaded: "500" })).toBe(false)
  })

  it("rejects a genuine zero at exact breakeven", () => {
    // downloaded === uploaded. The clamp and the truth agree here, so there is
    // nothing to repair and the row must not be written to.
    expect(isClampedRow(row("0", "500", "500"))).toBe(false)
  })

  it("rejects a genuine zero on an account in surplus", () => {
    expect(isClampedRow(row("0", "900", "500"))).toBe(false)
  })

  it("rejects a row that already carries a negative buffer", () => {
    // Written post-fix, or by a previous --apply. This is what makes the script
    // idempotent.
    expect(isClampedRow(row("-400", "100", "500"))).toBe(false)
  })

  it("rejects a non-zero positive buffer", () => {
    expect(isClampedRow(row("400", "900", "500"))).toBe(false)
  })

  it("accepts bigint columns as well as postgres.js strings", () => {
    expect(isClampedRow({ buffer: 0n, uploaded: 100n, downloaded: 500n })).toBe(true)
    expect(isClampedRow({ buffer: 0n, uploaded: 500n, downloaded: 500n })).toBe(false)
  })

  it("stays exact past Number.MAX_SAFE_INTEGER", () => {
    // 2^53 and 2^53 + 1: two byte counts that differ by one byte but collapse
    // to the SAME float. A Number()-based predicate reads this as breakeven and
    // skips a clamp that really did fire.
    const uploaded = "9007199254740992"
    const downloaded = "9007199254740993"
    expect(Number(uploaded)).toBe(Number(downloaded))
    expect(isClampedRow(row("0", uploaded, downloaded))).toBe(true)
    expect(repairedBufferBytes(row("0", uploaded, downloaded))).toBe(-1n)
  })
})

describe("repairedBufferBytes", () => {
  it("returns uploaded - downloaded, signed", () => {
    expect(repairedBufferBytes(row("0", "100", "500"))).toBe(-400n)
  })

  it("reproduces the real Hawke deficit exactly", () => {
    const downloaded = "5627286052460"
    const uploaded = "3000000000000"
    expect(repairedBufferBytes(row("0", uploaded, downloaded))).toBe(-2627286052460n)
  })

  it("keeps full precision on byte counts past 2^53", () => {
    const result = repairedBufferBytes(row("0", "9007199254740993", "9007199254740994"))
    expect(result).toBe(-1n)
  })
})

describe("classifyPlatform", () => {
  // The registry in src/lib/adapters/index.ts. If an adapter is added there and
  // not here, the backfill must skip it rather than guess — that is what the
  // unknown case below asserts.
  const ALL_PLATFORMS = [
    "avistaz",
    "btn",
    "digitalcore",
    "gazelle",
    "ggn",
    "hawke",
    "iptorrents",
    "mam",
    "nebulance",
    "torrentleech",
    "unit3d",
  ]

  it("covers every adapter registered in the app", () => {
    expect(Object.keys(PLATFORM_BUCKETS).sort()).toEqual([...ALL_PLATFORMS].sort())
  })

  it.each([
    "avistaz",
    "btn",
    "digitalcore",
    "ggn",
    "iptorrents",
    "mam",
    "nebulance",
    "torrentleech",
  ])("%s is exact — it only ever derived buffer from the totals", (platform) => {
    expect(classifyPlatform(platform)).toBe(BUCKET_EXACT)
  })

  it("gazelle is an estimate — enriched sites overwrite with the tracker's own buffer", () => {
    expect(classifyPlatform("gazelle")).toBe(BUCKET_ESTIMATE)
  })

  it("hawke is skipped — it never clamped, so a stored 0 is the tracker's own", () => {
    expect(classifyPlatform("hawke")).toBe(BUCKET_NEVER_CLAMPED)
    expect(isRepairable(classifyPlatform("hawke"))).toBe(false)
  })

  it("unit3d is skipped — a deficit threw rather than clamping, so 0 is ambiguous", () => {
    expect(classifyPlatform("unit3d")).toBe(BUCKET_AMBIGUOUS)
    expect(isRepairable(classifyPlatform("unit3d"))).toBe(false)
  })

  it("an unrecognised platform is skipped, never repaired on assumption", () => {
    expect(classifyPlatform("some-adapter-added-later")).toBe(BUCKET_UNKNOWN)
    expect(classifyPlatform("")).toBe(BUCKET_UNKNOWN)
    expect(isRepairable(BUCKET_UNKNOWN)).toBe(false)
  })

  it("repairs exactly the two buckets that have a defensible value", () => {
    expect(isRepairable(BUCKET_EXACT)).toBe(true)
    expect(isRepairable(BUCKET_ESTIMATE)).toBe(true)
  })

  it("gives every skipped bucket a reason the output can print", () => {
    for (const bucket of [BUCKET_NEVER_CLAMPED, BUCKET_AMBIGUOUS, BUCKET_UNKNOWN]) {
      expect(SKIP_REASONS[bucket]).toBeTruthy()
    }
  })
})

describe("BUFFER_TABLES parity with the Drizzle schema", () => {
  // A rename in schema.ts with no matching edit here is the failure this catches:
  // the CLI is raw SQL, so it would either error mid-incident or, worse, match
  // nothing and report a clean bill of health.
  const specFor = (table: string) => BUFFER_TABLES.find((s: { table: string }) => s.table === table)

  const EXPECTED = [
    {
      table: schema.trackerSnapshots,
      bufferColumn: "buffer_bytes",
      uploadedColumn: "uploaded_bytes",
      downloadedColumn: "downloaded_bytes",
      dateColumn: "polled_at",
    },
    {
      table: schema.trackerDailyCheckpoints,
      bufferColumn: "buffer_bytes_end",
      uploadedColumn: "uploaded_bytes_end",
      downloadedColumn: "downloaded_bytes_end",
      dateColumn: "checkpoint_date",
    },
  ]

  it("names both tables that carry a buffer column and no others", () => {
    expect(BUFFER_TABLES.map((s: { table: string }) => s.table).sort()).toEqual([
      "tracker_daily_checkpoints",
      "tracker_snapshots",
    ])
  })

  it("maps every spec to columns that actually exist", () => {
    for (const expected of EXPECTED) {
      const spec = specFor(getTableName(expected.table))
      expect(spec).toBeDefined()

      const columnNames = Object.values(getTableColumns(expected.table)).map((c) => c.name)
      for (const key of [
        "bufferColumn",
        "uploadedColumn",
        "downloadedColumn",
        "dateColumn",
      ] as const) {
        expect(spec[key]).toBe(expected[key])
        expect(columnNames).toContain(expected[key])
      }
    }
  })

  it("targets a nullable buffer column — the NULL guard is load-bearing, not defensive", () => {
    for (const expected of EXPECTED) {
      const buffer = Object.values(getTableColumns(expected.table)).find(
        (c) => c.name === expected.bufferColumn
      )
      expect(buffer?.notNull).toBe(false)
    }
  })

  it("targets non-null uploaded/downloaded columns — the repair cannot hit a NULL", () => {
    for (const expected of EXPECTED) {
      const columns = Object.values(getTableColumns(expected.table))
      for (const name of [expected.uploadedColumn, expected.downloadedColumn]) {
        expect(columns.find((c) => c.name === name)?.notNull).toBe(true)
      }
    }
  })
})

describe("toDateKey", () => {
  it("reduces a polled_at Date to a day", () => {
    expect(toDateKey(new Date("2026-03-04T21:15:00.000Z"))).toBe("2026-03-04")
  })

  it("passes a checkpoint_date string through", () => {
    expect(toDateKey("2026-03-04")).toBe("2026-03-04")
  })

  it("returns null for a missing date rather than inventing one", () => {
    expect(toDateKey(null)).toBeNull()
    expect(toDateKey(undefined)).toBeNull()
  })
})

describe("formatSignedBytes", () => {
  it("keeps the sign on a deficit and scales on the magnitude", () => {
    expect(formatSignedBytes(-2627286052460n)).toBe("-2.38 TiB")
  })

  it("formats a surplus without a sign", () => {
    expect(formatSignedBytes(1024n ** 3n)).toBe("1.00 GiB")
  })

  it("zero-pads the hundredths so the column stays readable", () => {
    // 1 TiB + 50 GiB lands on .04, which must print as "1.04" and never "1.4".
    expect(formatSignedBytes(-(1024n ** 4n + 50n * 1024n ** 3n))).toBe("-1.04 TiB")
  })

  it("falls through to bytes below a KiB", () => {
    expect(formatSignedBytes(-512n)).toBe("-512 B")
    expect(formatSignedBytes(0n)).toBe("0 B")
  })

  it("stays exact on values that would lose precision as a float", () => {
    // 2^53 + 1 bytes. TiB is the largest unit, so this keeps scaling past it
    // rather than inventing a PiB row nothing in this app would ever reach.
    expect(formatSignedBytes(-9007199254740993n)).toBe("-8192.00 TiB")
  })
})

describe("summarize", () => {
  const candidate = (
    trackerId: number,
    table: string,
    date: string,
    uploaded = "100",
    downloaded = "500",
    platformType = "btn",
    trackerName = `tracker-${trackerId}`
  ) => ({ trackerId, trackerName, platformType, table, date, uploaded, downloaded })

  it("groups per tracker and per table with the date range touched", () => {
    const result = summarize([
      candidate(1, "tracker_snapshots", "2026-01-05"),
      candidate(1, "tracker_snapshots", "2026-03-09"),
      candidate(1, "tracker_snapshots", "2026-02-02"),
      candidate(1, "tracker_daily_checkpoints", "2026-02-02"),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].total).toBe(4)
    expect(result[0].perTable).toEqual([
      { table: "tracker_daily_checkpoints", rows: 1, oldest: "2026-02-02", newest: "2026-02-02" },
      { table: "tracker_snapshots", rows: 3, oldest: "2026-01-05", newest: "2026-03-09" },
    ])
  })

  it("carries the platform's bucket onto the entry", () => {
    const result = summarize([
      candidate(1, "tracker_snapshots", "2026-01-05", "100", "500", "hawke"),
      candidate(2, "tracker_snapshots", "2026-01-05", "100", "500", "gazelle"),
      candidate(3, "tracker_snapshots", "2026-01-05", "100", "500", "mam"),
    ])
    const bucketFor = (id: number) =>
      result.find((e: { trackerId: number }) => e.trackerId === id).bucket

    expect(bucketFor(1)).toBe(BUCKET_NEVER_CLAMPED)
    expect(bucketFor(2)).toBe(BUCKET_ESTIMATE)
    expect(bucketFor(3)).toBe(BUCKET_EXACT)
  })

  it("reports the deepest deficit the repair would write", () => {
    const result = summarize([
      candidate(1, "tracker_snapshots", "2026-01-05", "100", "500"),
      candidate(1, "tracker_snapshots", "2026-01-06", "100", "9000"),
      candidate(1, "tracker_snapshots", "2026-01-07", "100", "300"),
    ])
    expect(result[0].deepest).toBe(-8900n)
  })

  it("orders the worst-affected tracker first", () => {
    const result = summarize([
      candidate(1, "tracker_snapshots", "2026-01-05"),
      candidate(2, "tracker_snapshots", "2026-01-05"),
      candidate(2, "tracker_snapshots", "2026-01-06"),
      candidate(2, "tracker_snapshots", "2026-01-07"),
    ])
    expect(result.map((e: { trackerId: number }) => e.trackerId)).toEqual([2, 1])
  })

  it("handles a Date-valued polled_at alongside a string checkpoint_date", () => {
    const result = summarize([
      { ...candidate(1, "tracker_snapshots", ""), date: new Date("2026-04-01T03:00:00.000Z") },
      candidate(1, "tracker_daily_checkpoints", "2026-04-02"),
    ])
    const snapshots = result[0].perTable.find(
      (t: { table: string }) => t.table === "tracker_snapshots"
    )
    expect(snapshots.oldest).toBe("2026-04-01")
  })

  it("returns nothing for no candidates", () => {
    expect(summarize([])).toEqual([])
    expect(totalRows([])).toBe(0)
  })

  it("totals rows across a group", () => {
    const result = summarize([
      candidate(1, "tracker_snapshots", "2026-01-05"),
      candidate(2, "tracker_snapshots", "2026-01-05"),
      candidate(2, "tracker_daily_checkpoints", "2026-01-05"),
    ])
    expect(totalRows(result)).toBe(3)
  })
})

describe("parseArgs", () => {
  it("defaults to a dry run", () => {
    expect(parseArgs([])).toEqual({ apply: false, help: false, unknown: [] })
  })

  it("requires an explicit --apply to write", () => {
    expect(parseArgs(["--apply"]).apply).toBe(true)
  })

  it("accepts both help spellings", () => {
    expect(parseArgs(["--help"]).help).toBe(true)
    expect(parseArgs(["-h"]).help).toBe(true)
  })

  it("collects unrecognised arguments instead of ignoring them", () => {
    // A typo'd flag must not silently degrade to a dry run that the operator
    // reads as "nothing to do".
    expect(parseArgs(["--aply"]).unknown).toEqual(["--aply"])
    expect(parseArgs(["--apply", "--force"]).unknown).toEqual(["--force"])
  })
})

describe("buildConnectionString parity with recover.cjs", () => {
  // The copy in backfill-buffer.cjs is deliberate — requiring recover.cjs would
  // pull its module-scope argon2 into a tool that needs no crypto at all — so
  // this is the thing that stops the two from drifting.
  const KEYS = [
    "DATABASE_URL",
    "POSTGRES_HOST",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_PORT",
    "POSTGRES_DB",
  ]

  // Mutate process.env key by key and restore the same way. Reassigning the
  // whole object replaces Node's live env proxy with a plain object and leaks
  // into every test that runs after this file.
  const saved = new Map(KEYS.map((key) => [key, process.env[key]]))

  function setEnv(env: Record<string, string>) {
    for (const key of KEYS) delete process.env[key]
    for (const [key, value] of Object.entries(env)) process.env[key] = value
  }

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  const fixtures: Array<Record<string, string>> = [
    { DATABASE_URL: "postgresql://someone:pw@db:5432/tracker_tracker" },
    {
      POSTGRES_HOST: "tracker-tracker-db",
      POSTGRES_USER: "tt",
      POSTGRES_PASSWORD: "p@ss word/with+specials",
      POSTGRES_PORT: "5433",
      POSTGRES_DB: "tt_db",
    },
    // Only the password set: exercises every default, including the stderr
    // warning both copies emit when POSTGRES_HOST is missing.
    { POSTGRES_PASSWORD: "plain" },
  ]

  it.each(fixtures)("agrees with the original for fixture %#", (env) => {
    setEnv(env)
    const mine = buildConnectionString()
    setEnv(env)
    expect(mine).toBe(recover.buildConnectionString())
  })

  it("percent-encodes a password with URL-significant characters", () => {
    setEnv({ POSTGRES_HOST: "db", POSTGRES_PASSWORD: "p@ss:word/slash" })
    expect(buildConnectionString()).toContain("p%40ss%3Aword%2Fslash")
  })

  it("refuses to invent a connection when neither variable is set", () => {
    setEnv({})
    expect(() => buildConnectionString()).toThrow(/DATABASE_URL nor POSTGRES_PASSWORD/)
  })
})
