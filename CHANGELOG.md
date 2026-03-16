# Changelog

## [1.8.5](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.8.5) (2026-03-15)

### Bug Fixes

- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))

## [1.8.4](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.3...v1.8.4) (2026-03-15)

### Features

- Cached torrent fallback: stores last successful torrent list per tag, serves cached data when qBittorrent is unreachable, with stale data banner indicating cache age
- Anniversary milestone detection with dashboard alerts for tracker join date anniversaries
- Login timer dashboard setting (showLoginTimers) with shared state toggle
- Last access date field and enhanced community data in tracker adapters
- Bento grid slot system with explicit-positioning layout algorithms for tracker detail stat cards
- Responsive bento grid: 2-col (mobile), 3-col (md), and 3-or-4-col (lg) breakpoints with per-breakpoint layout algorithms
- Stat card alert system: danger glow, outline, and tooltip icon for ratio below required and negative buffer
- Daily buffer candlestick chart on tracker detail pages
- Dashboard alerts "Clear All" button for batch dismissal
- Login timer cards link to tracker site with hover external-link indicator
- Rank timeline: promotion/demotion chevrons (green/red), anniversary milestones, horizontal scroll
- Swipe/drag gestures on sidebar client carousel (pointer events with capture)
- 4 new draft trackers: AsianCinema, Bibliotik, UHDBits, Seed Pool
- TrackerHub slugs and status page URLs populated across 19 existing trackers
- Download client uptime tracking: 24h heartbeat history displayed as a horizontal status bar in each client's settings card, with 5-minute bucket granularity and long-term retention for future chart overlays
- Live active torrents: 5-second polling of actively transferring torrents on tracker detail page with live speed/state updates
- Per-client stat card breakdowns: Seeding and Total Size cards show per-client rows when multiple download clients are configured (stacked variant with sumIsHero)
- H&R risk separated from unsatisfied: stat card shows only stopped/paused unsatisfied torrents as actual risk, tooltip shows total unsatisfied count
- Required ratio fallback: stat card falls back to tracker registry minimumRatio when the tracker API doesn't provide requiredRatio (UNIT3D)
- Aggregate upload/download speeds shown inline in Active Uploads/Downloads section headers
- Untagged torrents now shown in tag group breakdown charts (donut, bar, treemap) when "Count Not Tagged" is enabled

### Security

- Strip announce URL passkeys from torrent responses at both cache-write time and API response time
- Sanitize raw error messages in client scheduler — generic messages to client, raw errors to server logs only

### Changed

- StatCard expanded with stacked and ring variants for bento grid layouts
- Tracker detail cards migrated to slot-based grid system with slot registry
- LoginTimers custom ring replaced with StatCard type=ring
- formatTimeAgo extracted to shared formatters module
- formatBytesNum improved with negative value handling and variable precision
- CoreStatCards refactored: buildCoreStatDescriptors extracted as pure data function, component wrapper removed
- Slot rendering consolidated: renderSlotElement single source in slot-registry, replaces duplicate SLOT_COMPONENT_MAP lookups
- loginDeadlineSlot promoted to span:2 with priority 30 (stacked data cards get triple promotion over compact ring)
- gazelleCommentsSlot guarded against NaN from missing API fields
- Explicit draft: true/false required on all tracker registry entries (enforced by test)
- Import order standardized across codebase
- Shared portal-based Tooltip component replaces all native title attributes and inline tooltip implementations across 15 files
- Backup settings restructured: Export, Restore, and Configuration split into separate sections
- "Encrypt backups" renamed to "Password-protect backups" for clarity
- Backup password field moved from Configuration to Export section (ephemeral per-export, not a saved setting)
- Storage path input visible outside scheduled backup toggle (used by both manual exports and scheduled backups)
- Backup Now saves to disk silently when storage path is available; browser download only as fallback
- Changelog dialog renders markdown instead of raw text
- Changelog version header auto-updates on release via pnpm version lifecycle hook
- Deep poll optimized: parallel per-tag torrent fetching replaces single unfiltered dump (20MB → 10MB, 33% faster), public torrents filtered out before processing
- Heartbeat interval reduced from 10s to 5s for more responsive speed data
- Deep poll minimum raised from 10s to 60s, default from 30s to 300s (full torrent dump is ~20MB)
- Download client settings: explicit Save/Discard buttons replace auto-save on every keystroke
- Client snapshot retention now uses configurable snapshotRetentionDays instead of hardcoded 30 days
- Fleet snapshots API max query window raised from 30 to 365 days
- Icons: seeding changed from anchor to seedling, seedbonus changed from star to gem, required ratio uses balance scale (distinct from ratio arrows and favorite star)
- StatCard shadow reduced from nm-raised to nm-raised-sm to prevent neighbor shadow bleed in grids
- Card component no longer applies overflow-hidden by default (was clipping neumorphic shadows on nested cards)
- ChartCard uses p-6/-m-6 breathing room for nested neumorphic shadows with documentation in globals.css
- Ecosystem stats (Total Uploaded/Downloaded/Buffer) now use unit prop for smaller unit text
- Unsatisfied torrents table: scrollable when >15 rows, percentage-based column widths, MarqueeText for long names
- Top Seeded and Elder Torrents tables: percentage-based column widths with edge padding
- Table component: overscroll-contain prevents elastic bounce on scrollable tables, empty state vertically centered
- Leeching and Upload Speed stat cards removed from Torrents tab (redundant with Active Downloads table and inline speed display)

### Fixed

- Chart spacing on tracker detail pages: reduced top margin from 78px to 16-40px (was designed for multi-tracker dashboard legends)
- Double/triple slot index mapping collision when algorithm promotes doubles to triples
- Sidebar duplicate filepath comment removed
- Color hex code validation bug
- Backup storage path validated on filesystem (mkdir + access check) when saving settings
- Backup Now disabled when configuration has unsaved changes
- Default storage path (/data/backups) shown in input instead of empty placeholder
- Export error messages now visible in Export section (were orphaned after section split)
- Hydration mismatch on tracker detail page: added loading.tsx for framework-level Suspense boundary
- Cross-seed donut chart vertically centered in card when adjacent Categories card is taller
- Tag group breakdown charts (donut/bar/treemap) now include "Untagged" slice when countUnmatched is enabled (previously only worked in numbers view)
- Uptime accumulator cleanup on client delete prevents FK violation on flush
- Backup restore uses onConflictDoNothing for uptime buckets to handle edge-case duplicates
- Active torrents poll correctly transitions state from "uploading"/"downloading" to stalled when torrent drops from active list
- POST /api/clients default pollIntervalSeconds fixed from 30 to 300 (was below the validated minimum of 60)

## v1.6.0 — Settings & Debug

### Features

- Debug button that shows raw API response output for tracker polling
- Settings page decomposed into section components

## v1.5.0 — Security & Backup Hardening

### Features

- Re-encryption for backup restore: tokens re-encrypted from backup salt to current salt via reencryptField()
- Progressive login throttling: escalating lockout delays (5 req → 30s, 10 → 2m, 15 → 15m, 20 → 1h) with 429 responses
- SSRF protection: isUnsafeNetworkHost blocks private/loopback/link-local addresses in tracker URLs

### Changed

- Extracted DB-aware privacy operations (createPrivacyMask, scrubSnapshotUsernames) into new privacy-db.ts module to eliminate duplication across 4 route handlers
- Added shared reencrypt() function in crypto.ts, used by change-password and backup-restore routes

### Fixed

- Critical SQL column mapping bug in scrubSnapshotUsernames: "group" → group_name (Drizzle schema field mapping)
- UTF-8 consistency in scrubSnapshotUsernames: LENGTH → CHAR_LENGTH
- Missing transaction error handling in change-password route (would crash with opaque 500)
- Master password now validated before parsing backup payload

## v1.4.0 — Docker & Deployment

### Changed

- Simplified backup process by removing encryption for automated backups
- Dockerfile optimized for drizzle-kit schema sync (dedicated build stage, bash in runner)
- Docker entrypoint improved for schema sync process
- PostgreSQL image updated to 17-alpine

### Fixed

- Proxy configuration updated to include tracker logo path
- Drizzle config dotenv handling improved

## v1.3.0 — Chart & Detail Overhaul

### Features

- Chart legend system overhaul: scroll pagination replaced with natural wrapping, adjustable spacing, and an All/None toggle button on multi-series charts
- Log scale toggle added to 6 dashboard charts (Buffer, Seedbonus, Active Torrents, Total Uploaded, Ratio Stability, Buffer Velocity) with auto-detect when data spans >100x range
- Tracker detail page redesign: TrackerHub status card with animated collapse, user ranks table with perk pills, release/notable/banned group badges, elder torrents table with rank column and marquee ticker
- Torrents tab: compact table mode, category acquisition chart, 3D torrent age scatter plot, dead torrents card, average seed time stat card and cohort chart, full-width unsatisfied progress bars
- Ratio chart: red dashed baseline at minimum required ratio
- StatCard tooltip support with hover popup
- Sidebar: archived tracker styling (dimmed, static dot, "Archived" label) and GitHub repo link
- New logo

### Refactoring

- Tracker detail page slimmed from 1,229 to 265 lines — extracted TrackerDetailHeader, UserProfileCard, AnalyticsTab, TrackerInfoTab, CoreStatCards, PollLog, platform-specific guard components, and independent data-fetching hooks with AbortControllers
- Dashboard page split into AnalyticsSection and EcosystemStatsSection components
- Chart preference hooks consolidated into shared `useChartPreferencesBase`
- StatCard value/unit prop split for consistent formatting

### Fixes

- Log(0) crash in ComparisonChart when switching to log scale with zero-value data points
- VolumeSurface3D (Upload Landscape) background now matches card surface instead of broken WebGL transparent
- Tracker GET endpoint hardened with column projection (excludes avatarData, encrypted tokens from response)
- computeDelta BigInt null guard prevents crash on missing snapshot data
- StrictMode abort race condition: loading state only clears when the active request completes
- Emoji picker overflow in tag group settings
- Proxy toggle disabled when no proxy is configured
- Join date input capped to today in both UI and API validation
- Redirect to dashboard after archiving a tracker
- Design system alignment: raw `<p>` elements replaced with `<H2>` component across dashboard sections
- Archived trackers no longer appear on the dashboard
- Normalized content categories: "Software" → "Apps", "Sport" → "Sports", "Animation" → "TV"
- Tracker registry test allows `loginIntervalDays: 0` to mean "no login interval policy"

## v0.1.0 — Initial Release

- Dashboard with aggregate stats, comparison charts, and tracker leaderboard
- Tracker detail pages with upload/download history, ratio, buffer, seedbonus, and seeding charts
- UNIT3D platform adapter with encrypted API token storage
- Master password auth with Argon2 hash + AES-256-GCM encryption
- Global polling interval (15 min – 24 hours) with unified batch timestamps
- Dark neumorphic UI with per-tracker accent colors
- Sidebar with drag-and-drop reorder, stat modes, and sort options
- Tracker registry with detailed data for Aither, Blutopia, FearNoPeer, OnlyEncodes, and Upload.cx
- TrackerHub integration for site status monitoring
- Rank progression timeline and rank change alerts
- Privacy mode with username/group redaction
- App-wide settings (privacy toggle, data scrub)
- Poll log with collapsible history per tracker
