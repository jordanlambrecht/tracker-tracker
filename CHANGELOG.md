# Changelog

## [2.8.7](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.7) (2026-04-10)

### Features

* **trackers:** detects truncated cookies

### Bug Fixes

* **events:** update event categories and improve error logging
* **trackers:** missing profile parsing items for AnimeZ

## [2.8.6](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.6) (2026-04-09)

### Bug Fixes

* **trackers:** profile parsing

## [2.8.5](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.5) (2026-04-09)

### Bug Fixes

* changelog now shows all missed releases not just latest
* **trackers:** add batch tolerance for overdue checks to prevent drift

## [2.8.4](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.4) (2026-04-09)

### Features

* new "What's New" dialog
* **settings:** log files now batch in the events tab

## [2.8.3](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.3) (2026-04-09)

### Features

* **logging:** added classifyFetchError for better error messages

### Bug Fixes

* **circuit-breaker:** reset consecutiveFailures on resume, add lastErrorAt + isManual tracking
* **proxy:** proxy now works with test connection endpoint
* **sidebar:** filter and sort dropdowns were clipping
* **trackers:** tooltip extraction in parseAvistazProfile

## [2.8.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.2) (2026-04-09)

## [2.8.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.1) (2026-04-09)

### Features

* **charts:** chart components now use useMemo
* **fleet:** added bucketed queries

## [2.8.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.8.0) (2026-04-08)

### Features

* add `getFilteredTorrents` function
* **backups:** security hardening
* better API limits for snapshots
* better logging, less silent failures, more try/catches
* retention notice! dashboard alert when unconfigured, setup wizard toggle
* **scheduler:** add SIGTERM handler
* **security:** add checks for adapter cookie injection and credential logging
* **tracker platforms:** add `metaFor` function and `PlatformMetaMap` interface
* **trackers:** added support for DigitalCore

### Bug Fixes

* **alerts:** reject unknown alert types
* **auth:** reject pending/setup tokens in getSession function
* **backup:** better validation for tracker baseUrl
* emoji enum leak
* **login:** bug where submit button would reset styling
* **nuke:** reset backfill status after scrub and delete
* **security-audit:** upper-bound pw length check
* ssr issue
* tag group batch validation
* **trackers:** force unique ids and boost validation in PATCH handler

## [2.7.3](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.7.3) (2026-03-31)

### Features

* **trackers:** update user classes requirements for animez tracker

## [2.7.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.7.2) (2026-03-31)

### Features

* **trackers:** details for digitalcore and luminarr (thanks @DGeyzer)

## [2.7.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.7.1) (2026-03-31)

### Bug Fixes

* minor stuff

## [2.7.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.7.0) (2026-03-31)

### Features

* add AvistaZ slots for activity and badges
* add ConfirmRemove and SaveDiscardBar components
* add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext
* add hint support to Input component and update BackupsSection to use it
* add lazy loading support to Card component
* add searchParams handling and initialTab prop to TrackerDetailPage
* add support for luminarr and darkPeers ( and)
* added confirmAction ui comp
* added support for the avistaz network
* beefed up Dialog component
* extend change-password API to handle notification target re-encryption
* implement SectionToggle and ProgressWidget components
* implement useActionStatus hook for managing action states
* **mam:** add bonus cap, VIP expiry, unsatisfied limit, and active HnR notifications
* **mam:** add Mousehole integration
* **mam:** add MyAnonaMouse adapter
* **mam:** add platform UI with health overview, badges, and FL Wedges chart
* new formatSpeed formatter
* new heatmap in torrent fleet on dashboard!
* new info tip icon system thing
* new notice component
* new skeleton loaders
* new useAnimatedPresence and useEscapeKey hooks
* parseIntClamped
* refactor dirty detection to buildPatch function
* removed gravatar fluff
* **security:** enhance security audit checks and improve vulnerability reporting
* **settings:** display database size
* **trackers:** added support for DarkPeers (, thanks @DGeyzer)
* **trackers:** added support for DarkPeers (, thanks @DGeyzer)
* useCrudCard hook

### Bug Fixes

*  avistaZ platform-based trackers not fetching user avatars
* add notice for TOTP disabled during backup restore
* add tabIndex to InfoTip
* **backups:** enforce maximum length for backup password to 128 characters
* bad styling
* better error handling for setup response messages
* boundaryGap bug on charts
* chart content not hiding on card collapse
* don't show editable user joined date for avistaz platform
* duplicate TrackerSummary export
* enforce character limits on proxy username, password, and mousehole URL
* ensure backfill flag is set after successful checkpoint backfill
* ensure default value reference is used in useLocalStorage hook
* ensure loading state is reset after API calls in AddTrackerDialog
* error logging for BigInt conversion failures
* error logging for BigInt conversion failures in computeTodayAtAGlance
* **errors:** improve error handling and logging for backup and tracker operations
* improve error handling for decryption failures in fetchAndMergeTorrents
* improve error handling in backup password operations
* json parsing error
* make footer logo load eagerly
* make nextjs happy with image components
* make validateHttpUrl function use dynamic error labels
* minor placeholder bug
* normalize tracker tags to lowercase
* oops
* oops 2
* optimize database queries
* optimize deletion of old checkpoints
* optimize torrent checkpoint insertion by batching database writes
* persist showTodayAtAGlance setting, serialize dates
* remove unused import
* removed unnecessary lazy loading from Elder Torrents section
* replace useEffect with useLayoutEffect
* resolve lint warnings, Copilot review issues, remove dead code, and harden error handling
* simplify shouldMount logic in ChartCard component
* unify error handling in SetupForm
* update drizzle-kit, drizzle-orm, and postgres to specific versions in Dockerfile
* update VALID_PLATFORMS to use VALID_PLATFORM_TYPES constant
* use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants
* use localDateStr for cutoff date in pruneOldCheckpoints function
* wrong Content-Type for cached avatar images
* x-axis was showing wrong values, zoom bug

## [2.5.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.5.0) (2026-03-26)

### Features

* **dashboard:** add Today At A Glance server logic, checkpoints, and deep poll fixes
* **dashboard:** add Today At A Glance UI
* **schema:** add daily checkpoint tables and TodayAtAGlance types

### Bug Fixes

* **api:** improve session expiration error message
* **auth:** return 401 on stale session instead of misleading credential errors
* **Icons:** update DownloadArrowIcon stroke width
* **ui:** prevent StatCard DOM prop leak

## [2.4.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.4.2) (2026-03-25)

### Features

* add development image to docker hub

### Bug Fixes

* **auth:** decouple cookie secure flag from node_env for self-hosted http deployments. Closes
* **Dockerfile:** update package.json for drizzle-kit with esbuild overrides
* preload fleet dashboard tab

## [2.4.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.4.0) (2026-03-23)

### Features

* add alertSlideIn keyframe animation
* add fetchTrackerStats for future live transit paper data
* add GitHub Actions workflow for building and pushing development Docker image
* add per-tracker pause polling
* add system events viewer and log management
* added Dialog and CopyButton components
* remote image upload
* **ui:** add pause/resume button
* **ui:** lazy-load chart sections, prefetch sidebar links, and fix scroll-to-top on navigation

### Bug Fixes

* added size props to dialog comp
* **api:** orpheus was not matching seeding/leeching to response
* better regex for splitting comparison values in timing safe check
* convert bold numbered rules to markdown list items
* deploy issues
* resolve biome lint warnings
* round dashOffset to 2 decimal places
* **trackers:** markdown rendering
* update notificationDeliveryState schema to add foreign key constraint for targetId
* update timestamp format
* update type imports for CollapsibleCard
* update workflow triggers to include development branch for pull requests
* wrong postgres setup in docker-compose

## [2.2.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.2.0) (2026-03-20)

### Features

* add notification delivery pipeline with circuit breaker and cooldowns
* add notification target CRUD API routes
* add notificationTargets and notificationDeliveryState schema tables
* add scoped error boundary for tracker detail page
* add server-data module with secure column projections
* add shared event detection functions and notification type definitions
* docs support for tooltips
* **docs:** brand spankin' new documentation site and integration
* expand TrackerLatestStats with bufferBytes, hitAndRuns, seedbonus, shareScore
* integrate notification targets with backup, restore, and nuke
* replace manual polling with TanStack Query
* wire notification dispatch into tracker polling scheduler

## [2.1.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.1.1) (2026-03-18)

## [2.1.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.1.0) (2026-03-18)

## [2.0.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.0.2) (2026-03-18)

## [2.0.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.0.1) (2026-03-18)

## [2.0.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v2.0.0) (2026-03-18)

### Features

* add boot-time scheduler recovery
* add client IP logging for auth routes
* add HKDF wrapping key and scheduler key store
* add optional BASE_URL env var with startup validation
* add per-tracker poll failure circuit breaker
* add poll-paused alert type and paused health status
* add resume endpoint and serialize circuit breaker state
* add resume UI for paused trackers
* add webhooks coming-soon placeholder to settings
* clear scheduler key on lockdown, nuke, password change, and restore
* migrate alert dismissals to database, add system alerts
* persist scheduler key on login, keep running through logout
* postgresql 18 infrastructure with migration script

### Bug Fixes

* add icons metadata for favicon
* biome filter for noImportantStyles
* **ci:** add tsx as devDep and use pnpm exec instead of npx
* **ci:** exclude template files from tracker barrel validation
* hopefully fixed un/pw field flashing on login screen
* wrap scrub-and-delete in a transaction

## [1.11.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.11.0) (2026-03-16)

### Features

* add logging for login, logout, and TOTP verification events
* enhance api error handling for multiple adapters
* ip ban check for tracker api calls
* log auth events for login, TOTP, and logout
* show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35))
* show per-endpoint debug info in tracker debug poll
* update UploadPolarChart with html escaping

### Bug Fixes

* add --ignore-scripts option to pnpm prune in Dockerfile
* disable clients with cleared credentials on restore
* favicon wasnt showing in production
* override browser autofill background styles for better UI consistency
* sanitize error message in backup restore response
* sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45))
* security audit now checks catch block body for ignore comments. Closes
* suppress 1Password autofill on non-login password fields
* update gazelleAuthStyle to use token
* update PUBLIC_PREFIX to include additional paths for image loading
* validate and trim inputs on tracker test and create routes

## [1.10.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.10.2) (2026-03-16)

### Bug Fixes

* update jsdom to v29.0.0 and dom-selector to v7.0.3

## [1.10.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.10.1) (2026-03-16)

### Features

* added logo to footer
* auto-fill proxy port based on selected type in ProxySection
* encrypt scheduled and manual backups with stored password

### Bug Fixes

* add .trivyignore file with CVE entries for vulnerability scanning
* add missing permissions for actions in CodeQL workflow
* **ci:** update codeql-action to v4, pin sbom-action version
* re-encrypt backup password on password change, clear on lockdown
* reduce CVE surface in Docker image
* update .trivyignore with additional CVE entries
* update tracker file detection method and enhance session secret length
* update Trivy to version 0.35.0 in CI and release workflows

## [1.9.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.9.0) (2026-03-16)

### Features

* add area and totals modes to daily volume chart
* add cross-seed network, size scatter, and category breakdown to fleet dashboard
* add sankey flow and parallel views to distribution chart
* add stacked and total view modes to comparison charts
* add volume heatmap and calendar charts
* added timestamp to dl client disconnect error

### Bug Fixes

* add missing alias for typography in vitest configuration
* commit-msg hook
* construct DATABASE_URL from POSTGRES env vars when not set

## [1.8.5](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.5) (2026-03-15)

### Bug Fixes

* remove redundant comment

## [1.8.4](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.4) (2026-03-15)

### Bug Fixes

* collapse tracker validation warnings

## [1.8.3](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.3) (2026-03-15)

### Bug Fixes

* update release scripts to push tags to specific origin

## [1.8.2](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.2) (2026-03-15)

### Features

* add security audit file tamper check in CI workflow

### Bug Fixes

* encode PostgreSQL password in DATABASE_URL and update healthcheck command
* refine tracker validation logic to exclude drafts and improve error messages

## [1.8.1](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.1) (2026-03-15)

### Bug Fixes

* move DEFAULT_API_PATHS to constants module

## [1.8.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.8.0) (2026-03-15)

## [1.7.0](https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v1.7.0) (2026-03-15)

### Features

* add 'warned' alert type to AlertsBanner for improved alert handling
* add adapterFetch function and integrate it into Unit3dAdapter for improved API handling
* add alert indicators to stat cards for ratio and buffer warnings
* add anniversary milestone detection with dashboard alerts
* add avatarRemoteUrl update in pollTracker for enhanced avatar handling
* add avatarUrl to Gazelle user stats and update phoenixproject with new user classes and rules
* add BackToTop component
* add cached torrent fallback to useTrackerTorrents hook
* add cached torrents fallback endpoint
* add cachedTorrents columns to downloadClients schema
* add changelog and health check API routes
* add chart preferences hook with DnD reorder and category support
* add clear-all button to alerts, external links on login timers
* add core security and utility libraries
* add custom UI component library
* add dashboard components with token and robustness fixes
* add dashboard settings API route and DB-backed hook
* add devIndicators configuration for improved development experience
* add DND reordering, explicit save, and numbers display to tag groups
* add feature components for settings management
* add fleet dashboard with torrent analytics across all clients
* add formatStatValue function and related tests
* add GET /api/clients/[id]/uptime endpoint
* add lastAccessDate field and enhanced community data in adapters
* add nebulance to valid platforms in tracker validation script
* add nebulanceMeta handling in TrackerDetailPage for improved tracker support
* add nebulanceMeta to AnalyticsTab for enhanced tracker details
* add Prettier
* add promotion/demotion indicators and anniversary milestones to rank timeline
* add qBittorrent client integration
* add quicklinks API route for DB persistence
* add re-encryption functionality for backup restore process and update validation rules for empty API tokens
* add React hooks for click-outside and localStorage
* add required ratio fallback to tracker minimum ratio
* add settings and admin API routes
* add settings page, dashboard layout, and page-level components
* add shared ECharts config builder functions
* add shared Icons, ChevronToggle, and ChartEmptyState components
* add showLoginTimers dashboard setting with shared state
* add support for Nebulance tracker, including adapter and tests
* add swipe/drag gestures to client carousel in sidebar
* add tag group and download client API routes
* add template for new tracker registry entries with guidance and validation steps
* add tracker API extensions with security hardening
* add unit display for ecosystem aggregate stats
* add untagged torrents to tag group breakdown charts
* add update check badge to sidebar
* add upload polar heatmap chart with day-of-week by hour breakdown
* add UptimeBar component to download client settings
* add useClickOutside hook with stable ref pattern
* added debug button that shows raw api response output
* added new tracker logos
* adjust download client poll interval defaults and snapshot retention
* backup system
* cache filtered torrent list on successful deep poll
* conditionally render Join Date input based on selected tracker properties
* **database:** add app_settings, tracker roles, and tracker snapshots tables with initial columns
* docker hardening — standalone output, node 24, multi-arch builds
* enhance security audit with raw SQL check and update test count
* enhance security documentation with comprehensive sections and updates
* enhance StatCard with stacked hero totals and unit support
* enhance tracker support with nebulance integration and improve alert handling
* expand security audit with inline suppression and 8 new checks
* harden auth routes with defense-in-depth security
* heartbeat chart for download clients
* implement bento grid slot system and layout algorithms
* implement explicit save/discard pattern for download client settings
* implement GGnAdapter with user stats fetching and response handling
* implement live active torrents polling and inline speed display
* improve table scrollability and chart card spacing
* include uptime buckets in backup and restore
* increase fleet snapshots query window to 365 days
* initial tracker registries/entries
* integrate uptime recording into heartbeat and deep poll
* login, auth, and totp
* new chart types
* new logo!
* optimize torrent polling with parallel per-tag fetching and state filtering
* portal tooltips, backup settings overhaul, changelog improvements
* refactor chart legend system with log scale support
* refactor EmojiPickerPopover to use createPortal for rendering and improve positioning logic
* refactor torrent stat cards with per-client breakdown and consolidated tables
* separate H&R risk from unsatisfied torrents with distinct display
* show stale data banner when using cached torrents
* Stores 5-minute heartbeat success/failure buckets per download client. Unique constraint on (clientId, bucketTs) prevents duplicates. Cascade delete on client removal. Added to wipe.ts for security scrub coverage.
* torrents tab polish, stat card tooltips, ratio baseline, log scale toggle
* tracker detail UX improvements and new torrent charts
* **trackers:** add new trackers HAWKE-UNO, Nebulance, and REDacted
* update avatarUrl function to include avatarRemoteUrl parameter for improved avatar handling
* update StarIcon and SeedingIcon, add RequiredRatioIcon
* wire responsive bento grid with 3-col and 2-col layout algorithms

### Bug Fixes

* add aria-label comment for anchor element
* add comment to ignore security audit for async JSON parsing in proxyFetch
* add container names for db and app services in docker-compose.yml
* add dynamic export to AuthLayout for forced dynamic rendering
* add linting step to CI and update dependency review workflow
* add loading boundary to prevent hydration mismatch on tracker detail page
* add permissions for CI workflow to comment on PRs
* add progressive login throttling, SSRF protection, and error sanitization
* add type annotations for TrackerRegistryEntry in TrackerOverviewGrid
* address PR security review findings
* address security audit findings
* allow lint step to continue on error and add dummy DATABASE_URL for build
* bump setup-qemu-action to v4 for node 24 compat
* color hex code bug
* correct barrel inclusion filter to match import format
* correct spelling of 'Sports' in VALID_CONTENT_CATEGORIES
* enhance compareVersions to strip pre-release and build metadata
* enhance tooltip accessibility and cleanup in StatCard component
* ensure master password is validated before parsing backup payload
* harden chart components against XSS and stale data
* harden tracker GET endpoint and align design system usage
* improve security test count verification by refining output parsing
* improve tracker validation comment handling in CI workflow
* improve UI component robustness and React patterns
* isolate drizzle-kit deps in dedicated build stage
* markdown not rendering in changelog dialog
* normalize content categories and update changelog
* now noClients is set based on the latest response every fetch.
* optimize line caching in getCachedLines function
* refactor tracker exports and initialize ALL_TRACKERS array
* remove onRefresh prop from FleetDashboard component
* remove unused onRefresh prop from FleetDashboardProps interface
* remove unused timeAgo function and update category map initialization
* reorder import
* reorder import
* reorder imports
* reorder imports
* replace corepack enable with npm install for pnpm in Dockerfile
* replace div with button for SortableTrackerItem accessibility improvements
* replace img with Image component for logo in Login and Setup pages
* resolve AuthShell hydration mismatch
* resolve biome a11y lint errors and barrel test quote mismatch
* tighten chart spacing on tracker pages, add daily buffer candlestick
* UI polish and input validation improvements
* update allowed content categories in tracker validation
* update base image to node:22-alpine and install corepack globally
* update color definitions to use OKLCH values instead of hex
* update Docker cache settings for multi-platform builds
* update drizzle-kit command path in docker-entrypoint.sh
* update import for CSSProperties type in ChartECharts component
* update import paths for ALL_TRACKERS and DEFAULT_API_PATHS in validate-trackers script
* update json parsing in proxyFetch to use async/await
* update key prop in perks mapping to include index for uniqueness
* update key prop in perks mapping to use perk label for uniqueness
* update matcher in proxy configuration to include trackerTracker_logo
* update packageManager version and upgrade @types/node in package.json and pnpm-lock.yaml
* update packageManager version in package.json and refactor routePathFromFile function
* update PostgreSQL image version to 17-alpine
* update security audit to include additional checks and improve documentation
* update security test count minimum from 41 to 78
* update security test for setup route username validation
* update SortableTrackerItem to use a div for accessibility and keyboard navigation
* update SortableTrackerItem to use a span for favorite toggle with accessibility improvements
* update version number in changelog to v1.3.0
* use built-in corepack in node:25-alpine base image
* use URL-based registry lookup in dashboard alerts
