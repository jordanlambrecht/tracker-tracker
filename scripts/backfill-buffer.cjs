// scripts/backfill-buffer.cjs
//
// One-shot repair for historical buffer values destroyed by the negative-buffer
// clamp.
//
// ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Buffer on a private tracker is SIGNED: an account in deficit has a negative
// buffer, and Hawke's own API returns values like -2627286052460. Until the
// signed-buffer fix, two helpers in src/lib/data-transforms.ts floored it:
//
//     floatBytesToBigInt(n)          BigInt(Math.max(0, Math.floor(n ?? 0)))
//     computeBufferBytes(up, down)   up > down ? up - down : 0n
//
// Ten of the eleven adapters routed buffer through one of those, so every
// snapshot taken while an account was in deficit stored a confident 0 instead of
// the shortfall. This is a time-series app, and that is the worst possible
// failure for one: a buffer chart floored at zero draws a FLAT LINE while the
// account deteriorates, pixel-identical to holding steady at breakeven. The
// operator watching that chart to see whether they are recovering was shown a
// graph that could not render them getting worse.
//
// The code is fixed. This script repairs what the clamp already wrote.
//
// ─── WHAT IT REPAIRS, AND WHAT IT CANNOT ────────────────────────────────────
//
// Only rows where the clamp demonstrably FIRED are candidates:
//
//     buffer = 0  AND  downloaded > uploaded
//
// A zero buffer on an account that is level or in surplus is a genuine zero and
// is never touched. A NULL buffer means "not measured" and is never touched.
// `= 0` excludes NULL by SQL semantics, which is the behaviour we want, not an
// oversight. For a candidate row, `uploaded - downloaded` is the repair.
//
// How good that repair is depends on which adapter wrote the row, and the
// difference is NOT cosmetic, because it decides whether a platform is rewritten at
// all. Every classification below was read off the adapter source and its git
// history, not assumed:
//
//   EXACT: avistaz, btn, digitalcore, ggn, iptorrents, mam, nebulance,
//   torrentleech. These only ever produced buffer via computeBufferBytes, so
//   buffer WAS defined as uploaded - downloaded. Removing the clamp reconstructs
//   the original value exactly. There is nothing approximate about these rows.
//
//   ESTIMATE: gazelle. Gazelle has two paths and both clamped, so every
//   candidate row really is clamp-fired; what is uncertain is which value the
//   clamp ate. fetchStats derives the buffer (exact), but on registry-enriched
//   sites fetchRaw OVERWRITES it with Gazelle's own reported buffer, which
//   freeleech and bonus-point spending untie from uploaded - downloaded. The
//   snapshot does not record which path produced it and enrichment can fail for
//   individual polls, so the split cannot be recovered per row. The whole
//   platform is reported as an estimate and the operator is told why.
//
//   SKIPPED, NEVER CLAMPED: hawke. The adapter has hand-rolled signed
//   arithmetic since its first commit (aec545d) and never called either clamping
//   helper. A Hawke row matching the predicate therefore did NOT come from a
//   clamp: the tracker itself reported a buffer of exactly 0. Rewriting it would
//   fabricate a deficit that Hawke never sent.
//
//   SKIPPED, AMBIGUOUS: unit3d. Before the fix, a UNIT3D deficit did not clamp,
//   it THREW: buffer arrives as a formatted string and parseBytes rejects a
//   leading minus, which failed the entire poll, so no row was written at all.
//   A stored UNIT3D zero is therefore most plausibly a genuine "0 B" the tracker
//   clamped at its own end (unrecoverable by any client) with only the rare
//   "unlimited buffer" build reaching computeBufferBytes. The two are
//   indistinguishable in the snapshot, so these rows are counted and reported
//   but never rewritten.
//
//   SKIPPED, UNKNOWN: any platform_type this script does not know. Reported by
//   name so an adapter added after this script is not silently repaired under
//   assumptions that were never checked for it.
//
// Skipped rows are counted and named in the output rather than quietly dropped.
// Silently declining to repair is as dishonest as silently rewriting.
//
// ─── HOW TO RUN IT ──────────────────────────────────────────────────────────
//
// Take a database dump first:
//
//     docker exec tracker-tracker-db sh -c \
//       'pg_dump -U "$POSTGRES_USER" tracker_tracker' > tracker-tracker-backup.sql
//
// Then, against a running stack from the published docker-compose.yml:
//
//     docker exec tracker-tracker-app tt-backfill-buffer           # dry run
//     docker exec tracker-tracker-app tt-backfill-buffer --apply   # commit
//
// No `-it`: unlike tt-recover this prompts for nothing, so it runs fine
// non-interactively. `docker exec` does not run the entrypoint, so it also does
// not inherit the DATABASE_URL the entrypoint builds. That is rebuilt from
// POSTGRES_* below, exactly as src/lib/db/index.ts does.
//
// Run it only on an image that already carries the signed-buffer fix, which is
// the image this script ships in, so pulling it is sufficient. Backfilling
// against the old code would repair history and then let the very next poll
// write a fresh clamped zero on top of it.
//
// It is idempotent: after a successful --apply every repaired row has a negative
// buffer, so it no longer matches `buffer = 0` and a second run finds nothing.
//
// ─── WHY THIS FILE IS PLAIN COMMONJS ────────────────────────────────────────
//
// Same constraint as scripts/recover.cjs: it has to run inside the production
// image, which is a Next.js *standalone* build with no tsx, no devDependencies
// and no npm/npx/corepack, so a .ts entry point is not runnable there.
// /app/package.json carries no "type" field, so /app is CommonJS.
//
// Its ONE external require is postgres, which is bundled into the server chunks
// and has no /app/node_modules entry of its own, so the Dockerfile copies the
// complete package in for the CLIs, and the comment there records why. It is at
// module scope so `tt-backfill-buffer --help` fails loudly if that ever stops
// resolving; the smoke step in .github/workflows/docker.yml asserts it on every
// pull request. Unlike recover.cjs this needs no argon2 and no crypto at all:
// buffer_bytes is not encrypted, which is what makes this the simpler tool.
//
// ─── CONSOLIDATION NOTE ─────────────────────────────────────────────────────
//
// The pure, database-free half is exported at the bottom and unit-tested by
// src/lib/__tests__/backfill-buffer.test.ts, which also asserts the column spec
// below against the live Drizzle schema so a rename cannot silently turn this
// into a no-op. buildConnectionString() is DUPLICATED from recover.cjs rather
// than imported: requiring that file would drag its module-scope argon2 into a
// tool that has no use for it. The test asserts the two agree.

"use strict"

// Deliberately at module scope. See "WHY THIS FILE IS PLAIN COMMONJS" above.
const postgres = require("postgres")

// ─── pure core: platform classification ─────────────────────────────────────

/** Rewritten. buffer was defined as uploaded - downloaded, so the repair is the original value. */
const BUCKET_EXACT = "exact"
/** Rewritten, but labelled: the tracker's own buffer may not have been uploaded - downloaded. */
const BUCKET_ESTIMATE = "estimate"
/** Not rewritten: this adapter never clamped, so a stored 0 is the tracker's own 0. */
const BUCKET_NEVER_CLAMPED = "never-clamped"
/** Not rewritten: a clamped value and a genuine 0 are indistinguishable here. */
const BUCKET_AMBIGUOUS = "ambiguous"
/** Not rewritten: platform_type is not one this script has reasoned about. */
const BUCKET_UNKNOWN = "unknown-platform"

/**
 * Every platform this script knows, and what its buffer history is worth.
 *
 * Derived by reading each adapter in src/lib/adapters/. See "WHAT IT REPAIRS"
 * above for the per-platform reasoning. An adapter added later lands in
 * BUCKET_UNKNOWN and is skipped, which is the safe default: the wrong entry here
 * either fabricates history or leaves it broken, and neither is detectable after
 * the fact.
 */
const PLATFORM_BUCKETS = {
  avistaz: BUCKET_EXACT,
  btn: BUCKET_EXACT,
  digitalcore: BUCKET_EXACT,
  gazelle: BUCKET_ESTIMATE,
  ggn: BUCKET_EXACT,
  hawke: BUCKET_NEVER_CLAMPED,
  iptorrents: BUCKET_EXACT,
  mam: BUCKET_EXACT,
  nebulance: BUCKET_EXACT,
  torrentleech: BUCKET_EXACT,
  unit3d: BUCKET_AMBIGUOUS,
}

/** Why each skipped bucket is skipped, in one line, for the operator-facing output. */
const SKIP_REASONS = {
  [BUCKET_NEVER_CLAMPED]:
    "this adapter has always stored buffer signed, so a 0 here is the tracker's own 0, not a clamp",
  [BUCKET_AMBIGUOUS]:
    "a deficit used to fail the whole poll rather than clamp, so a stored 0 is most likely the tracker's own clamp, which is unrecoverable",
  [BUCKET_UNKNOWN]:
    "unrecognised platform_type, so this script has not reasoned about how its adapter wrote buffer",
}

function classifyPlatform(platformType) {
  return PLATFORM_BUCKETS[platformType] ?? BUCKET_UNKNOWN
}

/** True for the two buckets whose rows this script is willing to rewrite. */
function isRepairable(bucket) {
  return bucket === BUCKET_EXACT || bucket === BUCKET_ESTIMATE
}

// ─── pure core: row selection and repair value ──────────────────────────────

/**
 * Every table carrying a buffer column, found by auditing src/lib/db/schema.ts
 * rather than assumed. Both are written from the same adapter value in
 * src/lib/tracker-scheduler.ts, so both took the same damage.
 *
 * tracker_snapshots is the time series itself. tracker_daily_checkpoints is the
 * end-of-day rollup behind Today At A Glance, which computes yesterday's buffer
 * delta as (yesterday - dayBefore), and two clamped zeroes there report a deficit
 * that is deepening as a change of exactly nothing.
 *
 * src/lib/__tests__/backfill-buffer.test.ts asserts these names against the live
 * Drizzle schema. Deliberately NOT included: the alert and notification payload
 * columns that mention buffer. Those are logs of what was said at the time, not
 * measurements, and rewriting them would falsify a record of a past event.
 */
const BUFFER_TABLES = [
  {
    table: "tracker_snapshots",
    bufferColumn: "buffer_bytes",
    uploadedColumn: "uploaded_bytes",
    downloadedColumn: "downloaded_bytes",
    dateColumn: "polled_at",
    label: "snapshots",
  },
  {
    table: "tracker_daily_checkpoints",
    bufferColumn: "buffer_bytes_end",
    uploadedColumn: "uploaded_bytes_end",
    downloadedColumn: "downloaded_bytes_end",
    dateColumn: "checkpoint_date",
    label: "daily checkpoints",
  },
]

/**
 * Coerce a bigint column to a bigint.
 *
 * postgres.js hands int8 back as a STRING to avoid the precision loss that
 * Number() would cause, and these columns hold byte counts well past 2^53. So
 * this goes through BigInt() and never Number()/parseInt(), which is the same
 * rule the application code follows for these columns.
 */
function toBigInt(value) {
  if (typeof value === "bigint") return value
  return BigInt(value)
}

/** As toBigInt, but preserves the null that a nullable buffer column can hold. */
function toBigIntOrNull(value) {
  if (value === null || value === undefined) return null
  return toBigInt(value)
}

/**
 * True when this row's zero buffer was written by the clamp.
 *
 * The three rejections are the whole safety story of this script:
 *
 *   buffer IS NULL      never measured, no clamp ran, nothing to repair
 *   buffer !== 0        either already signed, or a real surplus
 *   downloaded <= up    a genuine zero: an account exactly at breakeven, or one
 *                       that has only ever been in surplus. The clamp cannot
 *                       have fired here because uploaded - downloaded >= 0.
 *
 * Note the boundary: downloaded === uploaded is EXCLUDED. The clamp and the
 * truth agree at breakeven, so there is nothing to fix and rewriting it would be
 * a pointless write against a row the bug never touched.
 */
function isClampedRow(row) {
  const buffer = toBigIntOrNull(row.buffer)
  if (buffer === null || buffer !== 0n) return false
  return toBigInt(row.downloaded) > toBigInt(row.uploaded)
}

/**
 * The repaired value: plainly uploaded - downloaded, which for a candidate row
 * is always negative. This is what computeBufferBytes now returns, so a repaired
 * row is byte-identical to what a fresh poll of the same totals would write.
 */
function repairedBufferBytes(row) {
  return toBigInt(row.uploaded) - toBigInt(row.downloaded)
}

// ─── pure core: reporting ───────────────────────────────────────────────────

/**
 * Normalise a polled_at timestamp or a checkpoint_date to YYYY-MM-DD.
 *
 * The two tables' date columns come back differently (timestamp as a Date,
 * date as a string) and the summary only ever shows a range, so both collapse
 * to a plain day string that also sorts lexicographically.
 */
function toDateKey(value) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

const BYTE_UNITS = [
  { unit: "TiB", scale: 1024n ** 4n },
  { unit: "GiB", scale: 1024n ** 3n },
  { unit: "MiB", scale: 1024n ** 2n },
  { unit: "KiB", scale: 1024n },
]

/**
 * Render a signed byte count for the summary, e.g. "-2.39 TiB".
 *
 * Scales on the ABSOLUTE value and re-attaches the sign, so a deficit reads as a
 * large negative number rather than being flattened into the byte unit, the
 * same shape src/lib/formatters.ts uses, for the same reason. Division stays in
 * bigint (Number() on a byte count past 2^53 is the precision loss this repo
 * bans); the two decimal places come from a 100x scale-up before the divide.
 */
function formatSignedBytes(value) {
  const negative = value < 0n
  const abs = negative ? -value : value
  const sign = negative ? "-" : ""

  for (const { unit, scale } of BYTE_UNITS) {
    if (abs >= scale) {
      const hundredths = (abs * 100n) / scale
      return `${sign}${hundredths / 100n}.${String(hundredths % 100n).padStart(2, "0")} ${unit}`
    }
  }
  return `${sign}${abs} B`
}

/**
 * Fold candidate rows into one entry per tracker: how many rows in each table,
 * the oldest and newest day touched, and the deepest deficit the repair would
 * write.
 *
 * Takes rows shaped { trackerId, trackerName, platformType, table, date,
 * uploaded, downloaded } so the two tables reduce through the same code. Sorted
 * by row count then name, so the worst-affected tracker is the first thing the
 * operator reads.
 *
 * `deepest` exists so the dry run is checkable against reality rather than taken
 * on trust: it is the most negative value that would be written for that
 * tracker, and the operator can compare it with what the tracker's own profile
 * page says before committing anything.
 */
function summarize(rows) {
  const byTracker = new Map()

  for (const row of rows) {
    let entry = byTracker.get(row.trackerId)
    if (!entry) {
      entry = {
        trackerId: row.trackerId,
        trackerName: row.trackerName,
        platformType: row.platformType,
        bucket: classifyPlatform(row.platformType),
        total: 0,
        deepest: null,
        perTable: [],
      }
      byTracker.set(row.trackerId, entry)
    }

    let table = entry.perTable.find((t) => t.table === row.table)
    if (!table) {
      table = { table: row.table, rows: 0, oldest: null, newest: null }
      entry.perTable.push(table)
    }

    const day = toDateKey(row.date)
    table.rows++
    entry.total++
    if (day !== null) {
      if (table.oldest === null || day < table.oldest) table.oldest = day
      if (table.newest === null || day > table.newest) table.newest = day
    }

    const repaired = repairedBufferBytes(row)
    if (entry.deepest === null || repaired < entry.deepest) entry.deepest = repaired
  }

  const entries = [...byTracker.values()]
  for (const entry of entries) {
    entry.perTable.sort((a, b) => a.table.localeCompare(b.table))
  }
  entries.sort((a, b) => b.total - a.total || a.trackerName.localeCompare(b.trackerName))
  return entries
}

/** Total candidate rows across every tracker in a bucket. */
function totalRows(entries) {
  return entries.reduce((sum, e) => sum + e.total, 0)
}

// ─── CLI plumbing ───────────────────────────────────────────────────────────

const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_INCONSISTENT = 2

const out = (s) => process.stdout.write(s)
const err = (s) => process.stderr.write(s)

const HELP = `tt-backfill-buffer - repair historical buffer values flattened to zero

  Before the signed-buffer fix, an account in deficit recorded a buffer of
  exactly 0 instead of its shortfall, so the buffer chart drew a flat line while
  the account got worse. This rewrites the rows where that clamp fired:

      buffer = 0 AND downloaded > uploaded   ->   buffer = uploaded - downloaded

  Rows whose zero is genuine (breakeven, or an account that has only ever been
  in surplus) are never touched, and neither is a NULL (unmeasured) buffer.

  Trackers whose adapter never clamped, or where a clamped zero cannot be told
  apart from one the tracker itself reported, are counted and named but NOT
  rewritten. The output says which repairs are exact and which are estimates.

USAGE
  docker exec tracker-tracker-app tt-backfill-buffer [flags]

FLAGS
  --apply           Commit the repair. Without it this is a DRY RUN that reads
                    the database, reports exactly what would change, and writes
                    nothing.
  --help, -h        This text.

ENVIRONMENT
  DATABASE_URL                         or, for the bundled database:
  POSTGRES_HOST / _USER / _PASSWORD / _PORT / _DB

TAKE A DUMP FIRST
  docker exec tracker-tracker-db sh -c \\
    'pg_dump -U "$POSTGRES_USER" tracker_tracker' > tracker-tracker-backup.sql
`

function parseArgs(argv) {
  const args = { apply: false, help: false, unknown: [] }
  for (const a of argv) {
    if (a === "--apply") args.apply = true
    else if (a === "--help" || a === "-h") args.help = true
    else args.unknown.push(a)
  }
  return args
}

/**
 * Rebuild the connection string from POSTGRES_*.
 *
 * A byte-for-byte duplicate of buildConnectionString() in scripts/recover.cjs,
 * which itself mirrors src/lib/db/index.ts. Duplicated rather than required:
 * recover.cjs requires argon2 at module scope and this tool has no business
 * loading it. src/lib/__tests__/backfill-buffer.test.ts asserts the two produce
 * identical output so the copy cannot drift.
 *
 * It is not optional: DATABASE_URL is constructed and exported only inside
 * docker-entrypoint.sh, in the server's own process tree, so a `docker exec`
 * process sees POSTGRES_* and no DATABASE_URL at all.
 */
function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const password = process.env.POSTGRES_PASSWORD
  if (!password) {
    throw new Error(
      "Neither DATABASE_URL nor POSTGRES_PASSWORD is set, so there is no way to reach the database.\n" +
        "  Inside the app container both normally come from your compose file."
    )
  }
  const user = process.env.POSTGRES_USER ?? "postgres"
  const host = process.env.POSTGRES_HOST ?? "localhost"
  const port = process.env.POSTGRES_PORT ?? "5432"
  const name = process.env.POSTGRES_DB ?? "tracker_tracker"
  if (!process.env.POSTGRES_HOST) {
    err(
      "WARNING: POSTGRES_HOST is not set, falling back to 'localhost'. In the bundled\n" +
        "         compose stack the database is a separate container (tracker-tracker-db),\n" +
        "         so a connection refused here means that variable is missing.\n\n"
    )
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`
}

// ─── output ─────────────────────────────────────────────────────────────────

function printPerTable(entry) {
  for (const t of entry.perTable) {
    const range = t.oldest === null ? "no dates recorded" : `${t.oldest} .. ${t.newest}`
    out(`      ${t.table}: ${t.rows} row(s), ${range}\n`)
  }
}

/**
 * Per-tracker lines for the two groups that WILL be rewritten.
 *
 * The deepest line is the sanity check: compare it against what the tracker's
 * own profile page reports before running --apply. A wildly implausible number
 * there means the totals feeding it are wrong, and that is worth knowing while
 * this is still a dry run.
 */
function printTrackerLines(entries) {
  for (const entry of entries) {
    out(
      `  - ${entry.trackerName} (${entry.platformType}, #${entry.trackerId}): ${entry.total} row(s)\n`
    )
    printPerTable(entry)
    if (entry.deepest !== null) {
      out(
        `      deepest repaired buffer: ${formatSignedBytes(entry.deepest)} (${entry.deepest} bytes)\n`
      )
    }
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    out(HELP)
    return EXIT_OK
  }
  if (args.unknown.length > 0) {
    err(`Unrecognised argument(s): ${args.unknown.join(" ")}\n\n${HELP}`)
    return EXIT_USAGE
  }

  const mode = args.apply ? "APPLY" : "DRY RUN"
  out(`\n=== tracker-tracker signed-buffer backfill (${mode}) ===\n\n`)

  const sql = postgres(buildConnectionString(), {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  })

  try {
    // Explicit column projection, never SELECT *.
    const trackers = await sql`
      SELECT id, name, platform_type FROM trackers ORDER BY id
    `
    const trackerById = new Map(trackers.map((t) => [t.id, t]))

    if (trackers.length === 0) {
      out("No trackers are configured, so there is no buffer history to repair.\n\n")
      return EXIT_OK
    }

    // 1. Find every clamp-fired row, in both tables.
    //
    //    The predicate runs in SQL so only candidates cross the wire, because this is a
    //    time series and selecting it whole would be gratuitous. Every returned
    //    row is then re-checked with isClampedRow(), the same pure function the
    //    tests cover, so the tested logic really is the logic that gates the
    //    write. If the two ever disagree the script stops rather than guesses.
    const candidates = []
    for (const spec of BUFFER_TABLES) {
      const rows = await sql`
        SELECT
          tracker_id,
          ${sql(spec.dateColumn)},
          ${sql(spec.bufferColumn)},
          ${sql(spec.uploadedColumn)},
          ${sql(spec.downloadedColumn)}
        FROM ${sql(spec.table)}
        WHERE ${sql(spec.bufferColumn)} = 0
          AND ${sql(spec.downloadedColumn)} > ${sql(spec.uploadedColumn)}
      `

      for (const row of rows) {
        const shaped = {
          buffer: row[spec.bufferColumn],
          uploaded: row[spec.uploadedColumn],
          downloaded: row[spec.downloadedColumn],
        }
        if (!isClampedRow(shaped)) {
          err(
            `\nABORT: ${spec.table} returned a row the row filter rejects` +
              ` (tracker ${row.tracker_id}, buffer ${String(shaped.buffer)},` +
              ` uploaded ${String(shaped.uploaded)}, downloaded ${String(shaped.downloaded)}).\n\n` +
              "  The SQL predicate and isClampedRow() are meant to select exactly the same\n" +
              "  rows. They disagreed, which means one of them is wrong, and this tool will\n" +
              "  not write under that uncertainty. Nothing was changed.\n"
          )
          return EXIT_INCONSISTENT
        }

        const tracker = trackerById.get(row.tracker_id)
        candidates.push({
          trackerId: row.tracker_id,
          trackerName: tracker?.name ?? `(deleted tracker #${row.tracker_id})`,
          platformType: tracker?.platform_type ?? "(unknown)",
          table: spec.table,
          date: row[spec.dateColumn],
          uploaded: shaped.uploaded,
          downloaded: shaped.downloaded,
        })
      }
    }

    if (candidates.length === 0) {
      out(
        "[ok] No clamped rows found.\n\n" +
          "  Nothing in either table matches `buffer = 0 AND downloaded > uploaded`, so\n" +
          "  either no account was ever recorded in deficit or this backfill has already\n" +
          "  run. Nothing to do.\n\n"
      )
      return EXIT_OK
    }

    // 2. Split by what the platform's history is actually worth.
    const summary = summarize(candidates)
    const exact = summary.filter((e) => e.bucket === BUCKET_EXACT)
    const estimate = summary.filter((e) => e.bucket === BUCKET_ESTIMATE)
    const skipped = summary.filter((e) => !isRepairable(e.bucket))

    out(
      `Found ${candidates.length} row(s) where the clamp fired, across ${summary.length} tracker(s).\n`
    )
    out("Only rows with buffer = 0 AND downloaded > uploaded are considered; a genuine\n")
    out("zero (breakeven or surplus) and a NULL (unmeasured) buffer are never candidates.\n\n")

    if (exact.length > 0) {
      out(`── EXACT: ${totalRows(exact)} row(s) on ${exact.length} tracker(s) ──\n`)
      out("These adapters computed buffer as uploaded - downloaded and nothing else, so\n")
      out("removing the clamp reconstructs the original value exactly.\n")
      printTrackerLines(exact)
      out("\n")
    }

    if (estimate.length > 0) {
      out(`── ESTIMATE: ${totalRows(estimate)} row(s) on ${estimate.length} tracker(s) ──\n`)
      out("Platform(s): ")
      out(`${[...new Set(estimate.map((e) => e.platformType))].sort().join(", ")}\n`)
      out("These trackers can report their OWN buffer, which freeleech and bonus-point\n")
      out("spending untie from uploaded - downloaded. The clamp destroyed the reported\n")
      out("value and the snapshot does not record which path wrote the row, so\n")
      out("uploaded - downloaded is the best available estimate, right for the derived\n")
      out("polls, approximate for the enriched ones, and NOT the original number.\n")
      printTrackerLines(estimate)
      out("\n")
    }

    if (skipped.length > 0) {
      out(
        `── SKIPPED: ${totalRows(skipped)} row(s) on ${skipped.length} tracker(s), NOT rewritten ──\n`
      )
      for (const entry of skipped) {
        out(
          `  - ${entry.trackerName} (${entry.platformType}, #${entry.trackerId}): ${entry.total} row(s)\n`
        )
        out(`      ${SKIP_REASONS[entry.bucket]}\n`)
        // No "deepest" line here on purpose: for a skipped tracker that number
        // is a value this script has just decided NOT to write, and printing it
        // would read as a finding rather than as the arithmetic it is.
        printPerTable(entry)
      }
      out("\n  These zeroes are left exactly as they are. For them the true historical\n")
      out("  value is gone and no arithmetic here can bring it back, and inventing one\n")
      out("  would put a deficit in the chart that the tracker never reported.\n\n")
    }

    const repairable = [...exact, ...estimate]
    const eligibleIds = repairable.map((e) => e.trackerId)
    const plannedRows = totalRows(repairable)

    if (eligibleIds.length === 0) {
      out(
        "Nothing is eligible for repair. Every affected tracker is in the skipped\n" +
          "group above. Nothing was changed.\n\n"
      )
      return EXIT_OK
    }

    out(`Plan: rewrite ${plannedRows} row(s) across ${eligibleIds.length} tracker(s),\n`)
    out("      setting buffer = uploaded - downloaded.\n")

    if (!args.apply) {
      out(
        "\nDRY RUN. Nothing was written.\n\n" +
          "  Take a dump first if you have not:\n" +
          "    docker exec tracker-tracker-db sh -c 'pg_dump -U \"$POSTGRES_USER\" tracker_tracker' > backup.sql\n\n" +
          "  Then commit:\n" +
          "    docker exec tracker-tracker-app tt-backfill-buffer --apply\n\n"
      )
      return EXIT_OK
    }

    // 3. One transaction across both tables. The UPDATE restates the predicate
    //    rather than listing row ids, so the plan above and the write cannot
    //    drift apart between the SELECT and the UPDATE, and with the clamp gone
    //    from the code, nothing can produce a new matching row in between.
    let applied = 0
    await sql.begin(async (tx) => {
      for (const spec of BUFFER_TABLES) {
        const result = await tx`
          UPDATE ${tx(spec.table)}
          SET ${tx(spec.bufferColumn)} = ${tx(spec.uploadedColumn)} - ${tx(spec.downloadedColumn)}
          WHERE ${tx(spec.bufferColumn)} = 0
            AND ${tx(spec.downloadedColumn)} > ${tx(spec.uploadedColumn)}
            AND tracker_id IN ${tx(eligibleIds)}
        `
        applied += result.count
      }
    })

    out(`\n[ok] COMMITTED: ${applied} row(s) updated.\n`)

    if (applied !== plannedRows) {
      out(
        `\n[!!] The plan expected ${plannedRows} row(s) and ${applied} were written.\n` +
          "     The transaction committed and every written row satisfied the same\n" +
          "     predicate, so nothing is corrupt, but the counts should match. Re-run\n" +
          "     the dry run to confirm nothing is left, and check whether a poll landed\n" +
          "     while this was running.\n"
      )
    }

    out(
      "\n  Buffer history now shows deficits as the negative numbers they were.\n" +
        "  Charts read from the same rows, so a reload is enough, with no restart needed.\n"
    )
    if (estimate.length > 0) {
      out(
        "\n[!!] The estimate group above was written with uploaded - downloaded. For\n" +
          "     those trackers that is an approximation of a value the clamp destroyed,\n" +
          "     not a recovery of it. Read old points on their charts accordingly.\n"
      )
    }
    out("\n")
    return EXIT_OK
  } finally {
    await sql.end({ timeout: 5 })
  }
}

// Exported for src/lib/__tests__/backfill-buffer.test.ts. Everything here is
// pure: no database, and no environment reads outside buildConnectionString().
module.exports = {
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
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((e) => {
      err(`\nFAILED: ${e?.message ? e.message : String(e)}\n`)
      if (e?.stack) err(`${e.stack}\n`)
      err("\nNothing was committed unless a '[ok] COMMITTED' line appeared above.\n")
      process.exit(EXIT_USAGE)
    })
}
