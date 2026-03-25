# Changelog

## [2.4.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.3.0...v2.4.2) (2026-03-25)


### Features

- add development image to docker hub ([8785094](https://github.com/jordanlambrecht/tracker-tracker/commit/87850942f118ccfd23c0a04d537928cd3db82976))
- add fetchTrackerStats for future live transit paper data ([ed6662f](https://github.com/jordanlambrecht/tracker-tracker/commit/ed6662f0ac0c9990b6c96e8ae5616452385b6c26))
- add GitHub Actions workflow for building and pushing development Docker image ([dca0af0](https://github.com/jordanlambrecht/tracker-tracker/commit/dca0af0a75a4ce21fbe14414d86d4ecbe4d459d3))
- add per-tracker pause polling ([14a6c43](https://github.com/jordanlambrecht/tracker-tracker/commit/14a6c43cd6764924aba6e2fa592ef13d208b528a))
- add system events viewer and log management ([b01ed22](https://github.com/jordanlambrecht/tracker-tracker/commit/b01ed22ec2ecfefe7f12bb448998d2726cb6b7f9))
- remote image upload ([a480c34](https://github.com/jordanlambrecht/tracker-tracker/commit/a480c3470b7e97e44764c1d9c6d1bee356d22728))
- **ui:** add pause/resume button ([c89299e](https://github.com/jordanlambrecht/tracker-tracker/commit/c89299ee80b9ce5ab22743039b6abd40be5a27b6))
- **ui:** lazy-load chart sections, prefetch sidebar links, and fix scroll-to-top on navigation ([ba8f59e](https://github.com/jordanlambrecht/tracker-tracker/commit/ba8f59ee33a21be72034f296f5da1ae795e03c70))


### Bug Fixes

- **api:** orpheus was not matching seeding/leeching to response ([4569238](https://github.com/jordanlambrecht/tracker-tracker/commit/456923879b2970c46432bc9a0b604da2685bc31d))
- **auth:** decouple cookie secure flag from node_env for self-hosted http deployments. Closes [#101](https://github.com/jordanlambrecht/tracker-tracker/issues/101) ([b2a7902](https://github.com/jordanlambrecht/tracker-tracker/commit/b2a790245ca76f1ec3ef8220c273a4ab9ca508fd))
- better regex for splitting comparison values in timing safe check ([8c67a50](https://github.com/jordanlambrecht/tracker-tracker/commit/8c67a50cb64196831d7b021249eb76e84766e009))
- convert bold numbered rules to markdown list items ([6e96454](https://github.com/jordanlambrecht/tracker-tracker/commit/6e964541330cca791818aca5d703e03ac2165694))
- deploy issues ([cf45ea1](https://github.com/jordanlambrecht/tracker-tracker/commit/cf45ea19726b8f31db5080ebe93909dd0825e995))
- **Dockerfile:** update package.json for drizzle-kit with esbuild overrides ([bce0854](https://github.com/jordanlambrecht/tracker-tracker/commit/bce0854d8ea18cf4a99488ed6d9243b25fc71658))
- preload fleet dashboard tab ([5f08951](https://github.com/jordanlambrecht/tracker-tracker/commit/5f0895192f39a740927594ab6617f2c5c04b5708))
- resolve biome lint warnings ([af8807d](https://github.com/jordanlambrecht/tracker-tracker/commit/af8807d72847e139be396778a096a7695fc49123))
- **trackers:** markdown rendering ([a5fbdde](https://github.com/jordanlambrecht/tracker-tracker/commit/a5fbdde7056848bb58fdbe6f1e77a765a543842d))
- update type imports for CollapsibleCard ([23979d1](https://github.com/jordanlambrecht/tracker-tracker/commit/23979d1f6323bd3fa209c9ed19172dbd7d05b6db))
- update workflow triggers to include development branch for pull requests ([d159775](https://github.com/jordanlambrecht/tracker-tracker/commit/d15977566a9dbd341c0db6f3b67e0ace9bb70f16))
- wrong postgres setup in docker-compose (closes [#78](https://github.com/jordanlambrecht/tracker-tracker/issues/78)) ([a0a3e0e](https://github.com/jordanlambrecht/tracker-tracker/commit/a0a3e0e16fe4e3b97dea9c7ebc5616cb54e22332))


### Performance

- add 5s per-client fetch deadline ([558c4be](https://github.com/jordanlambrecht/tracker-tracker/commit/558c4be0f9b05b198fd09ca5df4aad0dc6cde637))
- **settings:** settings page optimizations ([63aabab](https://github.com/jordanlambrecht/tracker-tracker/commit/63aabab9afdfde3d492b81b86f581c4c035269d1))


### Refactoring

- **charts:** consolidate duplicate Fleet/Torrent chart pairs and normalize upstream data flow ([ca051a8](https://github.com/jordanlambrecht/tracker-tracker/commit/ca051a8f4284565f6b0c09e4c9f0522a70ff7e2c))
- **charts:** migrate time-series charts to time axis with shared helpers and quality fixes ([596396e](https://github.com/jordanlambrecht/tracker-tracker/commit/596396e205fe387799986af7f1ff8386e8f77d13))
- **charts:** reorganize chart support files into lib/ subfolder ([98a26d4](https://github.com/jordanlambrecht/tracker-tracker/commit/98a26d4fb4bf2fb7c3b02c4d38151a6b07fbb887))
- **Dockerfile:** cleaned up build stages ([3b96ff9](https://github.com/jordanlambrecht/tracker-tracker/commit/3b96ff964058f33d3fe8fd65bf7a6fcde9dbcd3b))
- **settings:** extract CollapsibleCard ([5487d19](https://github.com/jordanlambrecht/tracker-tracker/commit/5487d19d1ac2dd56c6bf2136f072edbcb7868fe5))
- **settings:** extract SettingsSection wrapper ([ea0572c](https://github.com/jordanlambrecht/tracker-tracker/commit/ea0572c603ef191494a37cd9fe7ca64447bce1d4))

## [2.4.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.3.0...v2.4.1) (2026-03-23)


### Features

- add development image to docker hub ([8785094](https://github.com/jordanlambrecht/tracker-tracker/commit/87850942f118ccfd23c0a04d537928cd3db82976))
- add fetchTrackerStats for future live transit paper data ([ed6662f](https://github.com/jordanlambrecht/tracker-tracker/commit/ed6662f0ac0c9990b6c96e8ae5616452385b6c26))
- add GitHub Actions workflow for building and pushing development Docker image ([dca0af0](https://github.com/jordanlambrecht/tracker-tracker/commit/dca0af0a75a4ce21fbe14414d86d4ecbe4d459d3))
- add per-tracker pause polling ([14a6c43](https://github.com/jordanlambrecht/tracker-tracker/commit/14a6c43cd6764924aba6e2fa592ef13d208b528a))
- add system events viewer and log management ([b01ed22](https://github.com/jordanlambrecht/tracker-tracker/commit/b01ed22ec2ecfefe7f12bb448998d2726cb6b7f9))
- remote image upload ([a480c34](https://github.com/jordanlambrecht/tracker-tracker/commit/a480c3470b7e97e44764c1d9c6d1bee356d22728))
- **ui:** add pause/resume button ([c89299e](https://github.com/jordanlambrecht/tracker-tracker/commit/c89299ee80b9ce5ab22743039b6abd40be5a27b6))
- **ui:** lazy-load chart sections, prefetch sidebar links, and fix scroll-to-top on navigation ([ba8f59e](https://github.com/jordanlambrecht/tracker-tracker/commit/ba8f59ee33a21be72034f296f5da1ae795e03c70))


### Bug Fixes

- **api:** orpheus was not matching seeding/leeching to response ([4569238](https://github.com/jordanlambrecht/tracker-tracker/commit/456923879b2970c46432bc9a0b604da2685bc31d))
- better regex for splitting comparison values in timing safe check ([8c67a50](https://github.com/jordanlambrecht/tracker-tracker/commit/8c67a50cb64196831d7b021249eb76e84766e009))
- convert bold numbered rules to markdown list items ([6e96454](https://github.com/jordanlambrecht/tracker-tracker/commit/6e964541330cca791818aca5d703e03ac2165694))
- deploy issues ([cf45ea1](https://github.com/jordanlambrecht/tracker-tracker/commit/cf45ea19726b8f31db5080ebe93909dd0825e995))
- preload fleet dashboard tab ([5f08951](https://github.com/jordanlambrecht/tracker-tracker/commit/5f0895192f39a740927594ab6617f2c5c04b5708))
- resolve biome lint warnings ([af8807d](https://github.com/jordanlambrecht/tracker-tracker/commit/af8807d72847e139be396778a096a7695fc49123))
- **trackers:** markdown rendering ([a5fbdde](https://github.com/jordanlambrecht/tracker-tracker/commit/a5fbdde7056848bb58fdbe6f1e77a765a543842d))
- update type imports for CollapsibleCard ([23979d1](https://github.com/jordanlambrecht/tracker-tracker/commit/23979d1f6323bd3fa209c9ed19172dbd7d05b6db))
- update workflow triggers to include development branch for pull requests ([d159775](https://github.com/jordanlambrecht/tracker-tracker/commit/d15977566a9dbd341c0db6f3b67e0ace9bb70f16))
- wrong postgres setup in docker-compose (closes [#78](https://github.com/jordanlambrecht/tracker-tracker/issues/78)) ([a0a3e0e](https://github.com/jordanlambrecht/tracker-tracker/commit/a0a3e0e16fe4e3b97dea9c7ebc5616cb54e22332))


### Performance

- add 5s per-client fetch deadline ([558c4be](https://github.com/jordanlambrecht/tracker-tracker/commit/558c4be0f9b05b198fd09ca5df4aad0dc6cde637))
- **settings:** settings page optimizations ([63aabab](https://github.com/jordanlambrecht/tracker-tracker/commit/63aabab9afdfde3d492b81b86f581c4c035269d1))


### Refactoring

- **charts:** consolidate duplicate Fleet/Torrent chart pairs and normalize upstream data flow ([ca051a8](https://github.com/jordanlambrecht/tracker-tracker/commit/ca051a8f4284565f6b0c09e4c9f0522a70ff7e2c))
- **charts:** migrate time-series charts to time axis with shared helpers and quality fixes ([596396e](https://github.com/jordanlambrecht/tracker-tracker/commit/596396e205fe387799986af7f1ff8386e8f77d13))
- **charts:** reorganize chart support files into lib/ subfolder ([98a26d4](https://github.com/jordanlambrecht/tracker-tracker/commit/98a26d4fb4bf2fb7c3b02c4d38151a6b07fbb887))
- **settings:** extract CollapsibleCard ([5487d19](https://github.com/jordanlambrecht/tracker-tracker/commit/5487d19d1ac2dd56c6bf2136f072edbcb7868fe5))
- **settings:** extract SettingsSection wrapper ([ea0572c](https://github.com/jordanlambrecht/tracker-tracker/commit/ea0572c603ef191494a37cd9fe7ca64447bce1d4))

## [2.4.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.3.0...v2.4.0) (2026-03-23)


### Features

- add fetchTrackerStats for future live transit paper data ([ed6662f](https://github.com/jordanlambrecht/tracker-tracker/commit/ed6662f0ac0c9990b6c96e8ae5616452385b6c26))
- add GitHub Actions workflow for building and pushing development Docker image ([dca0af0](https://github.com/jordanlambrecht/tracker-tracker/commit/dca0af0a75a4ce21fbe14414d86d4ecbe4d459d3))
- add per-tracker pause polling ([14a6c43](https://github.com/jordanlambrecht/tracker-tracker/commit/14a6c43cd6764924aba6e2fa592ef13d208b528a))
- add system events viewer and log management ([b01ed22](https://github.com/jordanlambrecht/tracker-tracker/commit/b01ed22ec2ecfefe7f12bb448998d2726cb6b7f9))
- remote image upload ([a480c34](https://github.com/jordanlambrecht/tracker-tracker/commit/a480c3470b7e97e44764c1d9c6d1bee356d22728))
- **ui:** add pause/resume button ([c89299e](https://github.com/jordanlambrecht/tracker-tracker/commit/c89299ee80b9ce5ab22743039b6abd40be5a27b6))
- **ui:** lazy-load chart sections, prefetch sidebar links, and fix scroll-to-top on navigation ([ba8f59e](https://github.com/jordanlambrecht/tracker-tracker/commit/ba8f59ee33a21be72034f296f5da1ae795e03c70))


### Bug Fixes

- **api:** orpheus was not matching seeding/leeching to response ([4569238](https://github.com/jordanlambrecht/tracker-tracker/commit/456923879b2970c46432bc9a0b604da2685bc31d))
- better regex for splitting comparison values in timing safe check ([8c67a50](https://github.com/jordanlambrecht/tracker-tracker/commit/8c67a50cb64196831d7b021249eb76e84766e009))
- convert bold numbered rules to markdown list items ([6e96454](https://github.com/jordanlambrecht/tracker-tracker/commit/6e964541330cca791818aca5d703e03ac2165694))
- deploy issues ([cf45ea1](https://github.com/jordanlambrecht/tracker-tracker/commit/cf45ea19726b8f31db5080ebe93909dd0825e995))
- resolve biome lint warnings ([af8807d](https://github.com/jordanlambrecht/tracker-tracker/commit/af8807d72847e139be396778a096a7695fc49123))
- **trackers:** markdown rendering ([a5fbdde](https://github.com/jordanlambrecht/tracker-tracker/commit/a5fbdde7056848bb58fdbe6f1e77a765a543842d))
- update type imports for CollapsibleCard ([23979d1](https://github.com/jordanlambrecht/tracker-tracker/commit/23979d1f6323bd3fa209c9ed19172dbd7d05b6db))
- update workflow triggers to include development branch for pull requests ([d159775](https://github.com/jordanlambrecht/tracker-tracker/commit/d15977566a9dbd341c0db6f3b67e0ace9bb70f16))
- wrong postgres setup in docker-compose (closes [#78](https://github.com/jordanlambrecht/tracker-tracker/issues/78)) ([a0a3e0e](https://github.com/jordanlambrecht/tracker-tracker/commit/a0a3e0e16fe4e3b97dea9c7ebc5616cb54e22332))


### Performance

- add 5s per-client fetch deadline ([558c4be](https://github.com/jordanlambrecht/tracker-tracker/commit/558c4be0f9b05b198fd09ca5df4aad0dc6cde637))
- **settings:** settings page optimizations ([63aabab](https://github.com/jordanlambrecht/tracker-tracker/commit/63aabab9afdfde3d492b81b86f581c4c035269d1))


### Refactoring

- **charts:** consolidate duplicate Fleet/Torrent chart pairs and normalize upstream data flow ([ca051a8](https://github.com/jordanlambrecht/tracker-tracker/commit/ca051a8f4284565f6b0c09e4c9f0522a70ff7e2c))
- **charts:** migrate time-series charts to time axis with shared helpers and quality fixes ([596396e](https://github.com/jordanlambrecht/tracker-tracker/commit/596396e205fe387799986af7f1ff8386e8f77d13))
- **charts:** reorganize chart support files into lib/ subfolder ([98a26d4](https://github.com/jordanlambrecht/tracker-tracker/commit/98a26d4fb4bf2fb7c3b02c4d38151a6b07fbb887))
- **settings:** extract CollapsibleCard ([5487d19](https://github.com/jordanlambrecht/tracker-tracker/commit/5487d19d1ac2dd56c6bf2136f072edbcb7868fe5))
- **settings:** extract SettingsSection wrapper ([ea0572c](https://github.com/jordanlambrecht/tracker-tracker/commit/ea0572c603ef191494a37cd9fe7ca64447bce1d4))

## [2.3.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.1.1...v2.3.0) (2026-03-21)

### Features

- add alertSlideIn keyframe animation ([f59ab88](https://github.com/jordanlambrecht/tracker-tracker/commit/f59ab8854669d8592422da27f8e74a9c7d643216))
- add notification delivery pipeline with circuit breaker and cooldowns ([14d3982](https://github.com/jordanlambrecht/tracker-tracker/commit/14d3982c19e017b5d4b932953bcc8ae6fcfbd839))
- add notification target CRUD API routes ([a367039](https://github.com/jordanlambrecht/tracker-tracker/commit/a367039735950988f612d7fe986cf491f90a3dd9))
- add notificationTargets and notificationDeliveryState schema tables ([785a641](https://github.com/jordanlambrecht/tracker-tracker/commit/785a641fd8dc69cc9e9e51bad202110f70b12fde))
- add scoped error boundary for tracker detail page ([e4ad230](https://github.com/jordanlambrecht/tracker-tracker/commit/e4ad2302d34bfea1954cd1485bdc56e985267e69))
- add server-data module with secure column projections ([49fc00e](https://github.com/jordanlambrecht/tracker-tracker/commit/49fc00e4c21c37ae8d20b9630a12ddd917a68ebf))
- add shared event detection functions and notification type definitions ([4c217bb](https://github.com/jordanlambrecht/tracker-tracker/commit/4c217bb1fe794bcba87a21c255028ee112c0732d))
- added Dialog and CopyButton components ([a732148](https://github.com/jordanlambrecht/tracker-tracker/commit/a732148512ef3cc444d6828b0d17d4c7906f444e))
- docs support for tooltips ([406528f](https://github.com/jordanlambrecht/tracker-tracker/commit/406528f40466e52ef153056c209ff40aa7a7456d))
- **docs:** brand spankin' new documentation site and integration ([2c644d4](https://github.com/jordanlambrecht/tracker-tracker/commit/2c644d412bcf91d78564df596df01e1032843848))
- expand TrackerLatestStats with bufferBytes, hitAndRuns, seedbonus, shareScore ([a818e1a](https://github.com/jordanlambrecht/tracker-tracker/commit/a818e1ad1995d157577e454a1de89d227826304b))
- integrate notification targets with backup, restore, and nuke ([655393e](https://github.com/jordanlambrecht/tracker-tracker/commit/655393ebc32887548e7bcea5a08d2db3cb62410f))
- replace manual polling with TanStack Query ([0129020](https://github.com/jordanlambrecht/tracker-tracker/commit/0129020d3caba64431485bd4d7fb7b3647853fab))
- wire notification dispatch into tracker polling scheduler ([1d8f4fc](https://github.com/jordanlambrecht/tracker-tracker/commit/1d8f4fc622d79400f0bf52b7fc7678fd123dea42))

### Bug Fixes

- added size props to dialog comp ([46a8160](https://github.com/jordanlambrecht/tracker-tracker/commit/46a816081276ab068310b36a040ee6ada8fd4441))
- round dashOffset to 2 decimal places ([5f23be2](https://github.com/jordanlambrecht/tracker-tracker/commit/5f23be24545c5544bd96813288b4bd065bc2d246))
- update notificationDeliveryState schema to add foreign key constraint for targetId ([1319b8d](https://github.com/jordanlambrecht/tracker-tracker/commit/1319b8d168cd192627ab9c874120174317034738))
- update timestamp format ([2d01aba](https://github.com/jordanlambrecht/tracker-tracker/commit/2d01abaf76a46e7f93353ce1e17461d3d112e22a))

### Refactoring

- add getProxyTrackers function to fetch proxy-enabled trackers ([17cf490](https://github.com/jordanlambrecht/tracker-tracker/commit/17cf4903c1047a00dc62ea3d2e8614cdc74f06ec))
- adopt React 19 ref-as-prop pattern ([a936c8f](https://github.com/jordanlambrecht/tracker-tracker/commit/a936c8fa8fec9f00a0952680a419f3a2bc5e04ca))
- better joinedAt logic ([24c2e1d](https://github.com/jordanlambrecht/tracker-tracker/commit/24c2e1d0c6da41f237963635466170d3066f5e97))
- changed snapshot retrieval logic ([75613b1](https://github.com/jordanlambrecht/tracker-tracker/commit/75613b11a40e7114988037fb255e8e087038e49e))
- consolidate API GET handlers to use server-data functions ([3d6b686](https://github.com/jordanlambrecht/tracker-tracker/commit/3d6b68656f43edfbd7b548e4fafc9fb0c57e149b))
- migrate API route params to async props.params for Next.js 16 ([6a4efba](https://github.com/jordanlambrecht/tracker-tracker/commit/6a4efba993f1e990bddf388cb7a8921de1a33e32))
- move login and setup redirect logic server-side ([168ae57](https://github.com/jordanlambrecht/tracker-tracker/commit/168ae579e694d253987cc5f2ffe4d4042bf7c268))
- replace tracker list with proxy trackers in settings page ([c7d0c47](https://github.com/jordanlambrecht/tracker-tracker/commit/c7d0c4792067515bd004211fd7850d50150e78ac))
- settingspage to use server-side data fetching ([ff27517](https://github.com/jordanlambrecht/tracker-tracker/commit/ff27517304598d9ebab0bb2ed7bc1053e75dd0c7))
- simplify database query ([44de4aa](https://github.com/jordanlambrecht/tracker-tracker/commit/44de4aaed114048bfd82374e8fa800d4eeb6e311))
- split authenticated pages into server and client components ([246287a](https://github.com/jordanlambrecht/tracker-tracker/commit/246287a16a0180c23efefebef7ea6d27a03b5f74))
- update dismissAllAlerts logic to use persistDismiss ([411e98e](https://github.com/jordanlambrecht/tracker-tracker/commit/411e98e4fd4a791fd4355e64d1dcf86917597a0f))
- update fetch calls in useDashboardData to support signal for aborting requests ([0ae0dbc](https://github.com/jordanlambrecht/tracker-tracker/commit/0ae0dbcbd765de08457449f0e3b2a324c426518f))
- use shared detection functions in dashboard alerts and tracker status ([04aca35](https://github.com/jordanlambrecht/tracker-tracker/commit/04aca35e6d8c37e20f47f49d3604911c047b281e))

## [2.2.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.1.1...v2.2.0) (2026-03-20)

### Features

- add notification delivery pipeline with circuit breaker and cooldowns ([14d3982](https://github.com/jordanlambrecht/tracker-tracker/commit/14d3982c19e017b5d4b932953bcc8ae6fcfbd839))
- add notification target CRUD API routes ([a367039](https://github.com/jordanlambrecht/tracker-tracker/commit/a367039735950988f612d7fe986cf491f90a3dd9))
- add notificationTargets and notificationDeliveryState schema tables ([785a641](https://github.com/jordanlambrecht/tracker-tracker/commit/785a641fd8dc69cc9e9e51bad202110f70b12fde))
- add scoped error boundary for tracker detail page ([e4ad230](https://github.com/jordanlambrecht/tracker-tracker/commit/e4ad2302d34bfea1954cd1485bdc56e985267e69))
- add server-data module with secure column projections ([49fc00e](https://github.com/jordanlambrecht/tracker-tracker/commit/49fc00e4c21c37ae8d20b9630a12ddd917a68ebf))
- add shared event detection functions and notification type definitions ([4c217bb](https://github.com/jordanlambrecht/tracker-tracker/commit/4c217bb1fe794bcba87a21c255028ee112c0732d))
- docs support for tooltips ([406528f](https://github.com/jordanlambrecht/tracker-tracker/commit/406528f40466e52ef153056c209ff40aa7a7456d))
- **docs:** brand spankin' new documentation site and integration ([2c644d4](https://github.com/jordanlambrecht/tracker-tracker/commit/2c644d412bcf91d78564df596df01e1032843848))
- expand TrackerLatestStats with bufferBytes, hitAndRuns, seedbonus, shareScore ([a818e1a](https://github.com/jordanlambrecht/tracker-tracker/commit/a818e1ad1995d157577e454a1de89d227826304b))
- integrate notification targets with backup, restore, and nuke ([655393e](https://github.com/jordanlambrecht/tracker-tracker/commit/655393ebc32887548e7bcea5a08d2db3cb62410f))
- replace manual polling with TanStack Query ([0129020](https://github.com/jordanlambrecht/tracker-tracker/commit/0129020d3caba64431485bd4d7fb7b3647853fab))
- wire notification dispatch into tracker polling scheduler ([1d8f4fc](https://github.com/jordanlambrecht/tracker-tracker/commit/1d8f4fc622d79400f0bf52b7fc7678fd123dea42))

### Refactoring

- add getProxyTrackers function to fetch proxy-enabled trackers ([17cf490](https://github.com/jordanlambrecht/tracker-tracker/commit/17cf4903c1047a00dc62ea3d2e8614cdc74f06ec))
- adopt React 19 ref-as-prop pattern ([a936c8f](https://github.com/jordanlambrecht/tracker-tracker/commit/a936c8fa8fec9f00a0952680a419f3a2bc5e04ca))
- better joinedAt logic ([24c2e1d](https://github.com/jordanlambrecht/tracker-tracker/commit/24c2e1d0c6da41f237963635466170d3066f5e97))
- changed snapshot retrieval logic ([75613b1](https://github.com/jordanlambrecht/tracker-tracker/commit/75613b11a40e7114988037fb255e8e087038e49e))
- consolidate API GET handlers to use server-data functions ([3d6b686](https://github.com/jordanlambrecht/tracker-tracker/commit/3d6b68656f43edfbd7b548e4fafc9fb0c57e149b))
- migrate API route params to async props.params for Next.js 16 ([6a4efba](https://github.com/jordanlambrecht/tracker-tracker/commit/6a4efba993f1e990bddf388cb7a8921de1a33e32))
- move login and setup redirect logic server-side ([168ae57](https://github.com/jordanlambrecht/tracker-tracker/commit/168ae579e694d253987cc5f2ffe4d4042bf7c268))
- replace tracker list with proxy trackers in settings page ([c7d0c47](https://github.com/jordanlambrecht/tracker-tracker/commit/c7d0c4792067515bd004211fd7850d50150e78ac))
- settingspage to use server-side data fetching ([ff27517](https://github.com/jordanlambrecht/tracker-tracker/commit/ff27517304598d9ebab0bb2ed7bc1053e75dd0c7))
- simplify database query ([44de4aa](https://github.com/jordanlambrecht/tracker-tracker/commit/44de4aaed114048bfd82374e8fa800d4eeb6e311))
- split authenticated pages into server and client components ([246287a](https://github.com/jordanlambrecht/tracker-tracker/commit/246287a16a0180c23efefebef7ea6d27a03b5f74))
- update dismissAllAlerts logic to use persistDismiss ([411e98e](https://github.com/jordanlambrecht/tracker-tracker/commit/411e98e4fd4a791fd4355e64d1dcf86917597a0f))
- use shared detection functions in dashboard alerts and tracker status ([04aca35](https://github.com/jordanlambrecht/tracker-tracker/commit/04aca35e6d8c37e20f47f49d3604911c047b281e))

## [2.1.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.1.0...v2.1.1) (2026-03-18)

## [2.1.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.0.2...v2.1.0) (2026-03-18)

## [2.0.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.11.3...v2.0.2) (2026-03-18)

### Features

- add boot-time scheduler recovery ([b1b1499](https://github.com/jordanlambrecht/tracker-tracker/commit/b1b1499d4cce5cfd3a621c9023ffd1f47c04322f))
- add client IP logging for auth routes ([9442b62](https://github.com/jordanlambrecht/tracker-tracker/commit/9442b62d50a43f584f6d733ec7a0731d2bbf44ff))
- add HKDF wrapping key and scheduler key store ([6e579c1](https://github.com/jordanlambrecht/tracker-tracker/commit/6e579c136efab3811e3a074f4a463b46588f9be7))
- add optional BASE_URL env var with startup validation ([df1ff90](https://github.com/jordanlambrecht/tracker-tracker/commit/df1ff90e12e53d93ec13790ca5ae20f71524ba2a))
- add per-tracker poll failure circuit breaker ([f57ab8b](https://github.com/jordanlambrecht/tracker-tracker/commit/f57ab8bed174aa73f6a054c44178febba61e0068))
- add poll-paused alert type and paused health status ([a159abc](https://github.com/jordanlambrecht/tracker-tracker/commit/a159abc22cbee2df290861977ad373571d25a1f9))
- add resume endpoint and serialize circuit breaker state ([205a805](https://github.com/jordanlambrecht/tracker-tracker/commit/205a805983107b06b1fe4757be609e098f5892a3))
- add resume UI for paused trackers ([5ca9d8a](https://github.com/jordanlambrecht/tracker-tracker/commit/5ca9d8a625a7b70f07152e59c34cab07f09f27d0))
- add webhooks coming-soon placeholder to settings ([5cddf82](https://github.com/jordanlambrecht/tracker-tracker/commit/5cddf826edc04cc88b199229283bcd5ad9c37751))
- clear scheduler key on lockdown, nuke, password change, and restore ([493686e](https://github.com/jordanlambrecht/tracker-tracker/commit/493686ebf1054d146fb96e101e80204213c9d67b))
- migrate alert dismissals to database, add system alerts ([8e85869](https://github.com/jordanlambrecht/tracker-tracker/commit/8e85869786909ebcf52c80ed3cd9f686f201e5cd))
- persist scheduler key on login, keep running through logout ([eca1cad](https://github.com/jordanlambrecht/tracker-tracker/commit/eca1cad3ff7d7ef86cae43876e99b5cb1f75d9d9))
- postgresql 18 infrastructure with migration script ([4178cad](https://github.com/jordanlambrecht/tracker-tracker/commit/4178cad4d78dc210323850e5623ebc7b16505cb0))

### Bug Fixes

- add icons metadata for favicon ([d048355](https://github.com/jordanlambrecht/tracker-tracker/commit/d04835500a5d8071215a3613d678c1aaba51c7cd))
- biome filter for noImportantStyles ([ae2fd08](https://github.com/jordanlambrecht/tracker-tracker/commit/ae2fd08b542a2c87cd080ce59dffe8e47ffcaace))
- hopefully fixed un/pw field flashing on login screen ([2482473](https://github.com/jordanlambrecht/tracker-tracker/commit/2482473b950519f9bffe6cb459ec82f3bb2a9a73))

### Performance

- add database indexes, column type improvements, and connection pool tuning ([c949145](https://github.com/jordanlambrecht/tracker-tracker/commit/c949145f502fe6e549bc060e15af3f2f33eb59ca))
- distinct on query, column projections, batch inserts, jsonb/array cleanup ([f5cc7ca](https://github.com/jordanlambrecht/tracker-tracker/commit/f5cc7ca22d4c72740f627f321c0258abbd4fa96c))

### Refactoring

- centralize localStorage keys into storage-keys.ts ([501288e](https://github.com/jordanlambrecht/tracker-tracker/commit/501288e6bd5a5c1e3d0d9f0d2bffc32fd16ffdcb))
- consolidated the tag groups and download clients tabs in app settings ([41e1958](https://github.com/jordanlambrecht/tracker-tracker/commit/41e19583077fefe49a928c67824d64e646180a9f))
- extract scrubObject to shared utility for tests ([dd821d3](https://github.com/jordanlambrecht/tracker-tracker/commit/dd821d3681810b79c2bd923c82e319ef220e10ae))
- implement HKDF for session key derivation ([f38bccd](https://github.com/jordanlambrecht/tracker-tracker/commit/f38bccdb5043c643dc5d773a0b45396852369235))
- standardize chart helpers, imports, and axis labels ([b55f0df](https://github.com/jordanlambrecht/tracker-tracker/commit/b55f0dfdcb27d5af1a203b11e8e5e162fcb8e079))
- use HKDF for session key derivation ([d4a9001](https://github.com/jordanlambrecht/tracker-tracker/commit/d4a9001bd794e7c9a15f5e0fe085eddfd4ce84df))
- use optional chaining ([c260fe6](https://github.com/jordanlambrecht/tracker-tracker/commit/c260fe64b5cab12e29154cf397789cfcfd2cec88))

## [2.0.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.11.3...v2.0.1) (2026-03-18)

### Features

- add boot-time scheduler recovery ([b1b1499](https://github.com/jordanlambrecht/tracker-tracker/commit/b1b1499d4cce5cfd3a621c9023ffd1f47c04322f))
- add client IP logging for auth routes ([9442b62](https://github.com/jordanlambrecht/tracker-tracker/commit/9442b62d50a43f584f6d733ec7a0731d2bbf44ff))
- add HKDF wrapping key and scheduler key store ([6e579c1](https://github.com/jordanlambrecht/tracker-tracker/commit/6e579c136efab3811e3a074f4a463b46588f9be7))
- add optional BASE_URL env var with startup validation ([df1ff90](https://github.com/jordanlambrecht/tracker-tracker/commit/df1ff90e12e53d93ec13790ca5ae20f71524ba2a))
- add per-tracker poll failure circuit breaker ([f57ab8b](https://github.com/jordanlambrecht/tracker-tracker/commit/f57ab8bed174aa73f6a054c44178febba61e0068))
- add poll-paused alert type and paused health status ([a159abc](https://github.com/jordanlambrecht/tracker-tracker/commit/a159abc22cbee2df290861977ad373571d25a1f9))
- add resume endpoint and serialize circuit breaker state ([205a805](https://github.com/jordanlambrecht/tracker-tracker/commit/205a805983107b06b1fe4757be609e098f5892a3))
- add resume UI for paused trackers ([5ca9d8a](https://github.com/jordanlambrecht/tracker-tracker/commit/5ca9d8a625a7b70f07152e59c34cab07f09f27d0))
- add webhooks coming-soon placeholder to settings ([5cddf82](https://github.com/jordanlambrecht/tracker-tracker/commit/5cddf826edc04cc88b199229283bcd5ad9c37751))
- clear scheduler key on lockdown, nuke, password change, and restore ([493686e](https://github.com/jordanlambrecht/tracker-tracker/commit/493686ebf1054d146fb96e101e80204213c9d67b))
- migrate alert dismissals to database, add system alerts ([8e85869](https://github.com/jordanlambrecht/tracker-tracker/commit/8e85869786909ebcf52c80ed3cd9f686f201e5cd))
- persist scheduler key on login, keep running through logout ([eca1cad](https://github.com/jordanlambrecht/tracker-tracker/commit/eca1cad3ff7d7ef86cae43876e99b5cb1f75d9d9))
- postgresql 18 infrastructure with migration script ([4178cad](https://github.com/jordanlambrecht/tracker-tracker/commit/4178cad4d78dc210323850e5623ebc7b16505cb0))

### Bug Fixes

- add icons metadata for favicon ([d048355](https://github.com/jordanlambrecht/tracker-tracker/commit/d04835500a5d8071215a3613d678c1aaba51c7cd))
- biome filter for noImportantStyles ([ae2fd08](https://github.com/jordanlambrecht/tracker-tracker/commit/ae2fd08b542a2c87cd080ce59dffe8e47ffcaace))
- hopefully fixed un/pw field flashing on login screen ([2482473](https://github.com/jordanlambrecht/tracker-tracker/commit/2482473b950519f9bffe6cb459ec82f3bb2a9a73))

### Performance

- add database indexes, column type improvements, and connection pool tuning ([c949145](https://github.com/jordanlambrecht/tracker-tracker/commit/c949145f502fe6e549bc060e15af3f2f33eb59ca))
- distinct on query, column projections, batch inserts, jsonb/array cleanup ([f5cc7ca](https://github.com/jordanlambrecht/tracker-tracker/commit/f5cc7ca22d4c72740f627f321c0258abbd4fa96c))

### Refactoring

- centralize localStorage keys into storage-keys.ts ([501288e](https://github.com/jordanlambrecht/tracker-tracker/commit/501288e6bd5a5c1e3d0d9f0d2bffc32fd16ffdcb))
- consolidated the tag groups and download clients tabs in app settings ([41e1958](https://github.com/jordanlambrecht/tracker-tracker/commit/41e19583077fefe49a928c67824d64e646180a9f))
- extract scrubObject to shared utility for tests ([dd821d3](https://github.com/jordanlambrecht/tracker-tracker/commit/dd821d3681810b79c2bd923c82e319ef220e10ae))
- implement HKDF for session key derivation ([f38bccd](https://github.com/jordanlambrecht/tracker-tracker/commit/f38bccdb5043c643dc5d773a0b45396852369235))
- standardize chart helpers, imports, and axis labels ([b55f0df](https://github.com/jordanlambrecht/tracker-tracker/commit/b55f0dfdcb27d5af1a203b11e8e5e162fcb8e079))
- use HKDF for session key derivation ([d4a9001](https://github.com/jordanlambrecht/tracker-tracker/commit/d4a9001bd794e7c9a15f5e0fe085eddfd4ce84df))
- use optional chaining ([c260fe6](https://github.com/jordanlambrecht/tracker-tracker/commit/c260fe64b5cab12e29154cf397789cfcfd2cec88))

## [2.0.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.11.3...v2.0.0) (2026-03-18)

### Features

- add boot-time scheduler recovery ([b1b1499](https://github.com/jordanlambrecht/tracker-tracker/commit/b1b1499d4cce5cfd3a621c9023ffd1f47c04322f))
- add client IP logging for auth routes ([9442b62](https://github.com/jordanlambrecht/tracker-tracker/commit/9442b62d50a43f584f6d733ec7a0731d2bbf44ff))
- add HKDF wrapping key and scheduler key store ([6e579c1](https://github.com/jordanlambrecht/tracker-tracker/commit/6e579c136efab3811e3a074f4a463b46588f9be7))
- add optional BASE_URL env var with startup validation ([df1ff90](https://github.com/jordanlambrecht/tracker-tracker/commit/df1ff90e12e53d93ec13790ca5ae20f71524ba2a))
- add per-tracker poll failure circuit breaker ([f57ab8b](https://github.com/jordanlambrecht/tracker-tracker/commit/f57ab8bed174aa73f6a054c44178febba61e0068))
- add poll-paused alert type and paused health status ([a159abc](https://github.com/jordanlambrecht/tracker-tracker/commit/a159abc22cbee2df290861977ad373571d25a1f9))
- add resume endpoint and serialize circuit breaker state ([205a805](https://github.com/jordanlambrecht/tracker-tracker/commit/205a805983107b06b1fe4757be609e098f5892a3))
- add resume UI for paused trackers ([5ca9d8a](https://github.com/jordanlambrecht/tracker-tracker/commit/5ca9d8a625a7b70f07152e59c34cab07f09f27d0))
- add webhooks coming-soon placeholder to settings ([5cddf82](https://github.com/jordanlambrecht/tracker-tracker/commit/5cddf826edc04cc88b199229283bcd5ad9c37751))
- clear scheduler key on lockdown, nuke, password change, and restore ([493686e](https://github.com/jordanlambrecht/tracker-tracker/commit/493686ebf1054d146fb96e101e80204213c9d67b))
- migrate alert dismissals to database, add system alerts ([8e85869](https://github.com/jordanlambrecht/tracker-tracker/commit/8e85869786909ebcf52c80ed3cd9f686f201e5cd))
- persist scheduler key on login, keep running through logout ([eca1cad](https://github.com/jordanlambrecht/tracker-tracker/commit/eca1cad3ff7d7ef86cae43876e99b5cb1f75d9d9))
- postgresql 18 infrastructure with migration script ([4178cad](https://github.com/jordanlambrecht/tracker-tracker/commit/4178cad4d78dc210323850e5623ebc7b16505cb0))

### Bug Fixes

- add icons metadata for favicon ([d048355](https://github.com/jordanlambrecht/tracker-tracker/commit/d04835500a5d8071215a3613d678c1aaba51c7cd))
- biome filter for noImportantStyles ([ae2fd08](https://github.com/jordanlambrecht/tracker-tracker/commit/ae2fd08b542a2c87cd080ce59dffe8e47ffcaace))
- hopefully fixed un/pw field flashing on login screen ([2482473](https://github.com/jordanlambrecht/tracker-tracker/commit/2482473b950519f9bffe6cb459ec82f3bb2a9a73))

### Performance

- add database indexes, column type improvements, and connection pool tuning ([c949145](https://github.com/jordanlambrecht/tracker-tracker/commit/c949145f502fe6e549bc060e15af3f2f33eb59ca))
- distinct on query, column projections, batch inserts, jsonb/array cleanup ([f5cc7ca](https://github.com/jordanlambrecht/tracker-tracker/commit/f5cc7ca22d4c72740f627f321c0258abbd4fa96c))

### Refactoring

- centralize localStorage keys into storage-keys.ts ([501288e](https://github.com/jordanlambrecht/tracker-tracker/commit/501288e6bd5a5c1e3d0d9f0d2bffc32fd16ffdcb))
- consolidated the tag groups and download clients tabs in app settings ([41e1958](https://github.com/jordanlambrecht/tracker-tracker/commit/41e19583077fefe49a928c67824d64e646180a9f))
- extract scrubObject to shared utility for tests ([dd821d3](https://github.com/jordanlambrecht/tracker-tracker/commit/dd821d3681810b79c2bd923c82e319ef220e10ae))
- implement HKDF for session key derivation ([f38bccd](https://github.com/jordanlambrecht/tracker-tracker/commit/f38bccdb5043c643dc5d773a0b45396852369235))
- standardize chart helpers, imports, and axis labels ([b55f0df](https://github.com/jordanlambrecht/tracker-tracker/commit/b55f0dfdcb27d5af1a203b11e8e5e162fcb8e079))
- use HKDF for session key derivation ([d4a9001](https://github.com/jordanlambrecht/tracker-tracker/commit/d4a9001bd794e7c9a15f5e0fe085eddfd4ce84df))
- use optional chaining ([c260fe6](https://github.com/jordanlambrecht/tracker-tracker/commit/c260fe64b5cab12e29154cf397789cfcfd2cec88))

## [1.11.3](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.3) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
- enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
- ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
- log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
- show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
- show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
- update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** add tsx as devDep and use pnpm exec instead of npx ([e9c25eb](https://github.com/jordanlambrecht/tracker-tracker/commit/e9c25eb7d0e4431f4a897c55e277eb6eaed5afed))
- **ci:** exclude template files from tracker barrel validation ([7f6d4f4](https://github.com/jordanlambrecht/tracker-tracker/commit/7f6d4f4f17ed4e893461def6ded4f12b64482658))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
- favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
- override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
- sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
- security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
- suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
- update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
- validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))
- wrap scrub-and-delete in a transaction ([5378274](https://github.com/jordanlambrecht/tracker-tracker/commit/5378274637850e65c00c9a53c78f8a4ff115e59d))

### Refactoring

- replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.11.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.2) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
- enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
- ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
- log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
- show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
- show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
- update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** add tsx as devDep and use pnpm exec instead of npx ([e9c25eb](https://github.com/jordanlambrecht/tracker-tracker/commit/e9c25eb7d0e4431f4a897c55e277eb6eaed5afed))
- **ci:** exclude template files from tracker barrel validation ([7f6d4f4](https://github.com/jordanlambrecht/tracker-tracker/commit/7f6d4f4f17ed4e893461def6ded4f12b64482658))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
- favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
- override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
- sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
- security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
- suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
- update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
- validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))

### Refactoring

- replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.11.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.1) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
- enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
- ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
- log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
- show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
- show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
- update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** add tsx as devDep and use pnpm exec instead of npx ([e9c25eb](https://github.com/jordanlambrecht/tracker-tracker/commit/e9c25eb7d0e4431f4a897c55e277eb6eaed5afed))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
- favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
- override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
- sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
- security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
- suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
- update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
- validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))

### Refactoring

- replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.11.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.11.0) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))
- enhance api error handling for multiple adapters ([1891cef](https://github.com/jordanlambrecht/tracker-tracker/commit/1891cef6735e7ef0cf28bed1448a1ba0f35fb0da))
- ip ban check for tracker api calls ([39e9554](https://github.com/jordanlambrecht/tracker-tracker/commit/39e95548f89689b17eb0308255c9d1c204ac3254))
- log auth events for login, TOTP, and logout ([de3c0ce](https://github.com/jordanlambrecht/tracker-tracker/commit/de3c0cec82bc5d05444fb3e3a804c4cc1878e2ba))
- show last seen and error state on download client cards ([#35](https://github.com/jordanlambrecht/tracker-tracker/issues/35)) ([36c07e6](https://github.com/jordanlambrecht/tracker-tracker/commit/36c07e689fc93fd7f1d9589d0f72bd506102e92c))
- show per-endpoint debug info in tracker debug poll ([f088582](https://github.com/jordanlambrecht/tracker-tracker/commit/f088582119b1a9c0bb4e40c3088ecaf05aa12dbb))
- update UploadPolarChart with html escaping ([9720759](https://github.com/jordanlambrecht/tracker-tracker/commit/972075966b8ab6e3d092c06c725d407857c4fccc))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- disable clients with cleared credentials on restore ([14ee232](https://github.com/jordanlambrecht/tracker-tracker/commit/14ee232e1800e6e46ed89f57dcfb4a0e3a4f50a2))
- favicon wasnt showing in production ([d21622d](https://github.com/jordanlambrecht/tracker-tracker/commit/d21622d34063a0d0f88ff5fadcc335ac897e926f))
- override browser autofill background styles for better UI consistency ([999ca5a](https://github.com/jordanlambrecht/tracker-tracker/commit/999ca5ab9326cdb40ba7a6a1c1ae74ae932ed626))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- sanitize error message in backup restore response ([b0fabc6](https://github.com/jordanlambrecht/tracker-tracker/commit/b0fabc62bfaa3ed90d82cdd0ac0c6e8f36a12f5d))
- sec audit checks catch block for ignore comments ([#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45)) ([1504166](https://github.com/jordanlambrecht/tracker-tracker/commit/1504166aa22db59f4de7b400ce2e22d93088f33f))
- security audit now checks catch block body for ignore comments. Closes [#45](https://github.com/jordanlambrecht/tracker-tracker/issues/45) ([19f1cb7](https://github.com/jordanlambrecht/tracker-tracker/commit/19f1cb74258f923b1960b01de40c800ada840e8e))
- suppress 1Password autofill on non-login password fields ([c987318](https://github.com/jordanlambrecht/tracker-tracker/commit/c987318b2b1ae3d87a9d7a9de339d574f8a08240))
- update gazelleAuthStyle to use token ([96ca1f7](https://github.com/jordanlambrecht/tracker-tracker/commit/96ca1f78e31dcd6cb922fef39b8ce9824c806129))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))
- validate and trim inputs on tracker test and create routes ([0c9e27f](https://github.com/jordanlambrecht/tracker-tracker/commit/0c9e27f487d707da9ddcfd9c5f912bc7cbb47cf5))

### Refactoring

- replace auto-wipe with configurable account lockout ([1bab0c5](https://github.com/jordanlambrecht/tracker-tracker/commit/1bab0c5086cdd74c4bb8a1eea93adaf6ce4e0845))

## [1.10.4](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.4) (2026-03-16)

### Features

- add logging for login, logout, and TOTP verification events ([4bce6da](https://github.com/jordanlambrecht/tracker-tracker/commit/4bce6da45face537047df79d394686af49398360))

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))
- update PUBLIC_PREFIX to include additional paths for image loading ([8d8709a](https://github.com/jordanlambrecht/tracker-tracker/commit/8d8709acfb5c5e8c50baf90b9ef7fb6b562b2b1e))

## [1.10.3](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.3) (2026-03-16)

### Bug Fixes

- add --ignore-scripts option to pnpm prune in Dockerfile ([259ed39](https://github.com/jordanlambrecht/tracker-tracker/commit/259ed39e418080652e410227a227399c2444275c))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))

## [1.10.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.2) (2026-03-16)

### Bug Fixes

- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- update jsdom to v29.0.0 and dom-selector to v7.0.3 ([6565f35](https://github.com/jordanlambrecht/tracker-tracker/commit/6565f355c5cf6a1bb792a76ee8ab3b955701d0ae))

## [1.10.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.10.0...v1.10.1) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added logo to footer ([1270099](https://github.com/jordanlambrecht/tracker-tracker/commit/1270099c6ad49de2d09b0f6c768789b457e7c521))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))
- auto-fill proxy port based on selected type in ProxySection ([0e2f30e](https://github.com/jordanlambrecht/tracker-tracker/commit/0e2f30efdfbe544924cb2d2b9c16282acc6e70ac))
- encrypt scheduled and manual backups with stored password ([e514f9c](https://github.com/jordanlambrecht/tracker-tracker/commit/e514f9c5f8771690eb3ed6f623bf6881ab653a9e))

### Bug Fixes

- add .trivyignore file with CVE entries for vulnerability scanning ([e78d5e9](https://github.com/jordanlambrecht/tracker-tracker/commit/e78d5e9939f81349e2e82f5caa89510f850f0bc7))
- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- add missing permissions for actions in CodeQL workflow ([c1210df](https://github.com/jordanlambrecht/tracker-tracker/commit/c1210df290cccff1c7f333c6ee5df0cbb4d0e35e))
- **ci:** update codeql-action to v4, pin sbom-action version ([16082b8](https://github.com/jordanlambrecht/tracker-tracker/commit/16082b8694a7004f7a67cf2c2e970bd351455c43))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- re-encrypt backup password on password change, clear on lockdown ([cf7a3dc](https://github.com/jordanlambrecht/tracker-tracker/commit/cf7a3dca1e242501cbafde491e9f8654e7e8e78f))
- reduce CVE surface in Docker image ([d1196fc](https://github.com/jordanlambrecht/tracker-tracker/commit/d1196fc6487dce16bba46e05d2e39f5ab426596e))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))
- update .trivyignore with additional CVE entries ([88142b5](https://github.com/jordanlambrecht/tracker-tracker/commit/88142b5ad8a6cfe819b1611aa8760454b20ef7aa))
- update tracker file detection method and enhance session secret length ([5a23ccd](https://github.com/jordanlambrecht/tracker-tracker/commit/5a23ccdcade32f17fbd4a9d495ee65bce9e2df24))
- update Trivy to version 0.35.0 in CI and release workflows ([88877f4](https://github.com/jordanlambrecht/tracker-tracker/commit/88877f4cace97937a50d07218333f7b19b0d9b1e))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

## [1.10.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.10.0) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added logo to footer ([1270099](https://github.com/jordanlambrecht/tracker-tracker/commit/1270099c6ad49de2d09b0f6c768789b457e7c521))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))
- auto-fill proxy port based on selected type in ProxySection ([0e2f30e](https://github.com/jordanlambrecht/tracker-tracker/commit/0e2f30efdfbe544924cb2d2b9c16282acc6e70ac))
- encrypt scheduled and manual backups with stored password ([e514f9c](https://github.com/jordanlambrecht/tracker-tracker/commit/e514f9c5f8771690eb3ed6f623bf6881ab653a9e))

### Bug Fixes

- add .trivyignore file with CVE entries for vulnerability scanning ([e78d5e9](https://github.com/jordanlambrecht/tracker-tracker/commit/e78d5e9939f81349e2e82f5caa89510f850f0bc7))
- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- add missing permissions for actions in CodeQL workflow ([c1210df](https://github.com/jordanlambrecht/tracker-tracker/commit/c1210df290cccff1c7f333c6ee5df0cbb4d0e35e))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- re-encrypt backup password on password change, clear on lockdown ([cf7a3dc](https://github.com/jordanlambrecht/tracker-tracker/commit/cf7a3dca1e242501cbafde491e9f8654e7e8e78f))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))
- update .trivyignore with additional CVE entries ([88142b5](https://github.com/jordanlambrecht/tracker-tracker/commit/88142b5ad8a6cfe819b1611aa8760454b20ef7aa))
- update tracker file detection method and enhance session secret length ([5a23ccd](https://github.com/jordanlambrecht/tracker-tracker/commit/5a23ccdcade32f17fbd4a9d495ee65bce9e2df24))
- update Trivy to version 0.35.0 in CI and release workflows ([88877f4](https://github.com/jordanlambrecht/tracker-tracker/commit/88877f4cace97937a50d07218333f7b19b0d9b1e))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

## [1.9.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v1.8.4...v1.9.0) (2026-03-16)

### Features

- add area and totals modes to daily volume chart ([8c6636c](https://github.com/jordanlambrecht/tracker-tracker/commit/8c6636c3f0b0f99c6e88e47bba1f56aa92bb9983))
- add cross-seed network, size scatter, and category breakdown to fleet dashboard ([7e6bd67](https://github.com/jordanlambrecht/tracker-tracker/commit/7e6bd67998b14e4c221a9b1a50f120631b22c847))
- add sankey flow and parallel views to distribution chart ([58e2d7c](https://github.com/jordanlambrecht/tracker-tracker/commit/58e2d7c218dbb29743a94e0ea68954e752bede23))
- add stacked and total view modes to comparison charts ([cdf0f73](https://github.com/jordanlambrecht/tracker-tracker/commit/cdf0f732a82c675c07fcdd21c334603bce937298))
- add volume heatmap and calendar charts ([7848e89](https://github.com/jordanlambrecht/tracker-tracker/commit/7848e89ca8462afcb1fcc5808c817b5c0533d91d))
- added timestamp to dl client disconnect error ([0cfabe2](https://github.com/jordanlambrecht/tracker-tracker/commit/0cfabe26f4740ca8dd9e9cbef3c3e3b15be5818d))

### Bug Fixes

- add missing alias for typography in vitest configuration ([e7a7e34](https://github.com/jordanlambrecht/tracker-tracker/commit/e7a7e3498f199b1e3d99e6dd211183d486379a9e))
- commit-msg hook ([e8c81d1](https://github.com/jordanlambrecht/tracker-tracker/commit/e8c81d1cbbb077c2e3e385270d83f2443740b819))
- construct DATABASE_URL from POSTGRES env vars when not set ([c8c473a](https://github.com/jordanlambrecht/tracker-tracker/commit/c8c473a718bd47c50498a744c5b9c49572d38579))
- remove redundant comment ([18688d5](https://github.com/jordanlambrecht/tracker-tracker/commit/18688d5f1dc4cc1f7c78bb4825b1e9892a344dbf))

### Performance

- batch snapshot queries and eliminate redundant DB round-trip ([ec4f77b](https://github.com/jordanlambrecht/tracker-tracker/commit/ec4f77b9eb7d813e88304ade53faad01b731a00d))

### Refactoring

- consolidate chart utilities and wire into 25+ chart files ([426b017](https://github.com/jordanlambrecht/tracker-tracker/commit/426b01747095147cc970708b57cff61a4871a95e))
- extract shared server helpers and wire into consumers ([07c80d4](https://github.com/jordanlambrecht/tracker-tracker/commit/07c80d4e59863d0d15310841e57a3f558316b47d))
- merge TopTorrentsTable and ElderTorrentsTable into TorrentRankingTable ([003b01c](https://github.com/jordanlambrecht/tracker-tracker/commit/003b01ce9a002c30e0e1e5b91b61804656503023))
- streamline request creation in tracker routes tests ([13a42f7](https://github.com/jordanlambrecht/tracker-tracker/commit/13a42f793dd128f8d523ddebfa6953830dff09cb))

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
- 4 new draft trackers: AsianCinema, Bibliotik, UHDBits, SeedPool
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
- Global polling interval (15 min - 24 hours) with unified batch timestamps
- Dark neumorphic UI with per-tracker accent colors
- Sidebar with drag-and-drop reorder, stat modes, and sort options
- Tracker registry with detailed data for Aither, Blutopia, FearNoPeer, OnlyEncodes, and Upload.cx
- TrackerHub integration for site status monitoring
- Rank progression timeline and rank change alerts
- Privacy mode with username/group redaction
- App-wide settings (privacy toggle, data scrub)
- Poll log with collapsible history per tracker
