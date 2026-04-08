# Changelog

## [2.8.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.6.0...v2.8.0) (2026-04-08)


### Features

- add `getFilteredTorrents` function ([adb291b](https://github.com/jordanlambrecht/tracker-tracker/commit/adb291bd897135e61c8cf11018d1f1b0dc65c41a))
- add AvistaZ slots for activity and badges ([f4ba2e4](https://github.com/jordanlambrecht/tracker-tracker/commit/f4ba2e4dc530d75a7c14c87e202568a4905bdd34))
- add ConfirmRemove and SaveDiscardBar components ([01b3ee5](https://github.com/jordanlambrecht/tracker-tracker/commit/01b3ee5374f356822a4e6b14970f01666e865e85))
- add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext ([8f94cac](https://github.com/jordanlambrecht/tracker-tracker/commit/8f94caca9ef4dddb666bf27787725d099ef8cd1a))
- add hint support to Input component and update BackupsSection to use it ([91af8f0](https://github.com/jordanlambrecht/tracker-tracker/commit/91af8f00a2fbc1e020f92b054e945ee49fc822aa))
- add lazy loading support to Card component ([8e6be1f](https://github.com/jordanlambrecht/tracker-tracker/commit/8e6be1f9f6a65278be7ec78ddce1590553966de9))
- add searchParams handling and initialTab prop to TrackerDetailPage ([b32cb9c](https://github.com/jordanlambrecht/tracker-tracker/commit/b32cb9c0ae502ead5f4613ae59480c6e75a979aa))
- add support for luminarr and darkPeers (closes [#113](https://github.com/jordanlambrecht/tracker-tracker/issues/113) and [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114)) ([fe2bea2](https://github.com/jordanlambrecht/tracker-tracker/commit/fe2bea23597b862de4b3f979e7b48bf89f780a6a))
- added confirmAction ui comp ([0b0de15](https://github.com/jordanlambrecht/tracker-tracker/commit/0b0de158b56f705ec05babb1b2f9ac42d97a8752))
- added support for the avistaz network (closes [#112](https://github.com/jordanlambrecht/tracker-tracker/issues/112)) ([ad3ad57](https://github.com/jordanlambrecht/tracker-tracker/commit/ad3ad57a14e1d302c468350f2a254a192b893ae2))
- **backups:** security hardening ([87abaa0](https://github.com/jordanlambrecht/tracker-tracker/commit/87abaa05cc0f3b1a9bba84f2df98cb0012c13cb2))
- beefed up Dialog component ([b329e26](https://github.com/jordanlambrecht/tracker-tracker/commit/b329e264a9f83f8f92441a22ac337bb295f5c289))
- better API limits for snapshots ([561b4a4](https://github.com/jordanlambrecht/tracker-tracker/commit/561b4a4e3f9fb598e8a2ef292cac35cd484a80b7))
- better logging, less silent failures, more try/catches ([a91ba8a](https://github.com/jordanlambrecht/tracker-tracker/commit/a91ba8a339de12a61b59e8eac110e5c3288d99ce))
- extend change-password API to handle notification target re-encryption ([588a0ad](https://github.com/jordanlambrecht/tracker-tracker/commit/588a0ad2b3d2078427f0692c73053cee9b637481))
- implement SectionToggle and ProgressWidget components ([640e517](https://github.com/jordanlambrecht/tracker-tracker/commit/640e517652a6bb151374f30e24a026f42e1ab5e9))
- implement useActionStatus hook for managing action states ([710b7b1](https://github.com/jordanlambrecht/tracker-tracker/commit/710b7b1ac83237bfc8bcfabf711b649ddc17cc1e))
- new formatSpeed formatter ([4ec91a2](https://github.com/jordanlambrecht/tracker-tracker/commit/4ec91a2e65628b660985d4f0fa005fe84a2b85b4))
- new heatmap in torrent fleet on dashboard! ([829973d](https://github.com/jordanlambrecht/tracker-tracker/commit/829973d159289a93f4392385b14b5b69f5d077eb))
- new info tip icon system thing ([d865622](https://github.com/jordanlambrecht/tracker-tracker/commit/d865622c977e57a7952805f4701e29d6b109d182))
- new notice component ([d9c700d](https://github.com/jordanlambrecht/tracker-tracker/commit/d9c700d772e5dcdd507bf6102079ef4f48fedbeb))
- new skeleton loaders ([f9a7054](https://github.com/jordanlambrecht/tracker-tracker/commit/f9a7054a9bd3f140efab3b9ca326e19f9e5561ee))
- new useAnimatedPresence and useEscapeKey hooks ([02fc0f8](https://github.com/jordanlambrecht/tracker-tracker/commit/02fc0f87217a8e9b7622d163bb014744191bd6b5))
- parseIntClamped ([42b4c25](https://github.com/jordanlambrecht/tracker-tracker/commit/42b4c254ce8d67379e4a30f0220b1176f5ee4cdd))
- refactor dirty detection to buildPatch function ([b7e49f3](https://github.com/jordanlambrecht/tracker-tracker/commit/b7e49f3d1e36424a443292b43893cdbec9b460dd))
- removed gravatar fluff ([cb87cda](https://github.com/jordanlambrecht/tracker-tracker/commit/cb87cda8cc0340dece54802101c3270aa0fab7ac))
- retention notice! dashboard alert when unconfigured, setup wizard toggle ([7fb6993](https://github.com/jordanlambrecht/tracker-tracker/commit/7fb6993458add1eaa443092c3226cbe9aff559b2))
- **scheduler:** add SIGTERM handler ([a27f5bd](https://github.com/jordanlambrecht/tracker-tracker/commit/a27f5bde4d7fd3e1564d842c1aa429e4dcda956a))
- **security:** add checks for adapter cookie injection and credential logging ([461589c](https://github.com/jordanlambrecht/tracker-tracker/commit/461589cd83667397e3e6fb04953196df353f5750))
- **tracker platforms:** add `metaFor` function and `PlatformMetaMap` interface ([976eab0](https://github.com/jordanlambrecht/tracker-tracker/commit/976eab04e69b2f3550b99ca5e5d6fa88831d413b))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([e593117](https://github.com/jordanlambrecht/tracker-tracker/commit/e593117f9d0021b94a7d06fcd3f8dd8a5eb42cde))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([cd5f957](https://github.com/jordanlambrecht/tracker-tracker/commit/cd5f957efa3ffca57aa25698c3bc84b529b1e478))
- **trackers:** added support for DigitalCore (closes [#111](https://github.com/jordanlambrecht/tracker-tracker/issues/111), closes [#110](https://github.com/jordanlambrecht/tracker-tracker/issues/110)) ([e201804](https://github.com/jordanlambrecht/tracker-tracker/commit/e201804f9b2c9458fde486fe2346d3e015cfcd95))
- **trackers:** details for digitalcore and luminarr (thanks @DGeyzer) ([b3b621b](https://github.com/jordanlambrecht/tracker-tracker/commit/b3b621b1f44b77af28d1b35ef2b55d528c7cafa7))
- **trackers:** update user classes requirements for animez tracker ([3c41fc5](https://github.com/jordanlambrecht/tracker-tracker/commit/3c41fc54fa15549d57a93b839b851d4f000fb114))
- useCrudCard hook ([5a89c58](https://github.com/jordanlambrecht/tracker-tracker/commit/5a89c58cb9837da6b9ff140ebec72551cb9d339e))


### Bug Fixes

-  avistaZ platform-based trackers not fetching user avatars ([e7fe1df](https://github.com/jordanlambrecht/tracker-tracker/commit/e7fe1df4fa376b9041558fabb6c60022c591fcad))
- add notice for TOTP disabled during backup restore ([a603b35](https://github.com/jordanlambrecht/tracker-tracker/commit/a603b35aae1293dd75afcce19f01150fc8b36a90))
- add tabIndex to InfoTip ([fe4b46a](https://github.com/jordanlambrecht/tracker-tracker/commit/fe4b46a272ebb761f3bed2ce6a777735272d8aa7))
- **alerts:** reject unknown alert types ([f903fff](https://github.com/jordanlambrecht/tracker-tracker/commit/f903fff1b41aa5027a39ceae7b476640343d0f8c))
- **auth:** reject pending/setup tokens in getSession function ([6b2d6b4](https://github.com/jordanlambrecht/tracker-tracker/commit/6b2d6b478a0c0775080d32ab03822ef7936f1ffe))
- **backup:** better validation for tracker baseUrl ([8fc07f9](https://github.com/jordanlambrecht/tracker-tracker/commit/8fc07f934f4da754a95556f2aab9d20c591cd6da))
- bad styling ([748b851](https://github.com/jordanlambrecht/tracker-tracker/commit/748b851c5b0fff1f6e77586d1d22cac4d11ad0b3))
- better error handling for setup response messages ([bf7645a](https://github.com/jordanlambrecht/tracker-tracker/commit/bf7645a908322f4800416253e39a73ac594baf52))
- boundaryGap bug on charts ([8b1edc7](https://github.com/jordanlambrecht/tracker-tracker/commit/8b1edc7ce744d4cf61d89469fc3c9be5b29ed4d7))
- chart content not hiding on card collapse (closes [#34](https://github.com/jordanlambrecht/tracker-tracker/issues/34)) ([d29e391](https://github.com/jordanlambrecht/tracker-tracker/commit/d29e391be05ce063220b435e89d2474db2080772))
- don't show editable user joined date for avistaz platform ([e0884d7](https://github.com/jordanlambrecht/tracker-tracker/commit/e0884d723de87e3263954f86a5c4eb655e3efb47))
- duplicate TrackerSummary export ([0d79466](https://github.com/jordanlambrecht/tracker-tracker/commit/0d794667908fa5d47f0079dc995fd85f3cbacd22))
- emoji enum leak ([e29d376](https://github.com/jordanlambrecht/tracker-tracker/commit/e29d376e40beaa0c98db3728f7b46645955ba906))
- enforce character limits on proxy username, password, and mousehole URL ([8debdd2](https://github.com/jordanlambrecht/tracker-tracker/commit/8debdd28164ca854a150722133d9830630e009ef))
- ensure default value reference is used in useLocalStorage hook ([4cf6dba](https://github.com/jordanlambrecht/tracker-tracker/commit/4cf6dba6ae776fdcf7eaa8acb9b78694590c7bf2))
- ensure loading state is reset after API calls in AddTrackerDialog ([a971c64](https://github.com/jordanlambrecht/tracker-tracker/commit/a971c64f67d279f82a5c2645c87f03133474f554))
- improve error handling in backup password operations ([11c303a](https://github.com/jordanlambrecht/tracker-tracker/commit/11c303a539b24c552b40ffe909e74b71f6e27804))
- json parsing error ([d140679](https://github.com/jordanlambrecht/tracker-tracker/commit/d14067920d129847181d498f3044d0cbc1cc0c90))
- **login:** bug where submit button would reset styling ([67e4517](https://github.com/jordanlambrecht/tracker-tracker/commit/67e4517fa4dff38f4327aa07211c682e2e1fa797))
- make footer logo load eagerly ([fd9b6fa](https://github.com/jordanlambrecht/tracker-tracker/commit/fd9b6fa3ac2e55bf24338888352c559bee7fd144))
- make nextjs happy with image components ([826c566](https://github.com/jordanlambrecht/tracker-tracker/commit/826c56696f0116691f2e068f5a701ebc95f3be78))
- make validateHttpUrl function use dynamic error labels ([49482ba](https://github.com/jordanlambrecht/tracker-tracker/commit/49482ba2a90193a7f5f8bbe7bf7448e5d6dea0a8))
- minor placeholder bug ([9f8606b](https://github.com/jordanlambrecht/tracker-tracker/commit/9f8606b62cd05727ede0088132e2315fc101c5b5))
- minor stuff ([ca6496d](https://github.com/jordanlambrecht/tracker-tracker/commit/ca6496d7f12859148f62254ba8d1e8112e530387))
- **nuke:** reset backfill status after scrub and delete ([124de48](https://github.com/jordanlambrecht/tracker-tracker/commit/124de48a55adfd6fc57b1b31d4c9a64ef888dddd))
- oops ([fe9e801](https://github.com/jordanlambrecht/tracker-tracker/commit/fe9e801c5261d9e183a215b1a4072b544bd14e24))
- oops 2 ([f5a0d1a](https://github.com/jordanlambrecht/tracker-tracker/commit/f5a0d1aa9dcfe4a59bd2e9a098b0768ef42b1a4d))
- optimize database queries ([56ee982](https://github.com/jordanlambrecht/tracker-tracker/commit/56ee9829925c6edf0332afa1bda3e0dbed3b2481))
- optimize deletion of old checkpoints ([32a177d](https://github.com/jordanlambrecht/tracker-tracker/commit/32a177d75d4f652d3e7737dafe3324b122e0b6c9))
- persist showTodayAtAGlance setting, serialize dates ([f95f56c](https://github.com/jordanlambrecht/tracker-tracker/commit/f95f56c9c83fd5da10e779ad337f3ddf4715ebd0))
- remove unused import ([b454085](https://github.com/jordanlambrecht/tracker-tracker/commit/b454085a386dec9df8dc0d95427f0f650bf4d726))
- removed unnecessary lazy loading from Elder Torrents section ([35e3caa](https://github.com/jordanlambrecht/tracker-tracker/commit/35e3caa1e692eb4b498409b622069e62951a789e))
- replace useEffect with useLayoutEffect ([4dd01ad](https://github.com/jordanlambrecht/tracker-tracker/commit/4dd01ad8cb02ca3e713432dc3658a75a68053811))
- **security-audit:** upper-bound pw length check ([ac693e6](https://github.com/jordanlambrecht/tracker-tracker/commit/ac693e62609768c243cd9d1d606e405a1def3949))
- simplify shouldMount logic in ChartCard component ([673ed48](https://github.com/jordanlambrecht/tracker-tracker/commit/673ed483b38afb83968f58375fe65e04ad93c941))
- ssr issue ([2acf207](https://github.com/jordanlambrecht/tracker-tracker/commit/2acf20759463fc4502b55c26f51b51a8d4db5dd7))
- tag group batch validation ([4d25bcd](https://github.com/jordanlambrecht/tracker-tracker/commit/4d25bcd40967b6783dc0da2c963549867b7dba1a))
- **trackers:** force unique ids and boost validation in PATCH handler ([d9121e5](https://github.com/jordanlambrecht/tracker-tracker/commit/d9121e5c740f2443c8cc8890977db0e1bb8be94b))
- unify error handling in SetupForm ([7aec2ee](https://github.com/jordanlambrecht/tracker-tracker/commit/7aec2ee742e73dc9682cdf7c90e7a772fea3fda8))
- use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants ([f847941](https://github.com/jordanlambrecht/tracker-tracker/commit/f847941b7effd2d0f4b8abeab185f3ae703262d9))
- wrong Content-Type for cached avatar images ([ca9e1fa](https://github.com/jordanlambrecht/tracker-tracker/commit/ca9e1fa3a5217c6aeb1c6a95098436306a8879fb))
- x-axis was showing wrong values, zoom bug ([b6eea34](https://github.com/jordanlambrecht/tracker-tracker/commit/b6eea3499dcd050162ceca0e6ba2a94fc0a2b15e))


### Performance

- **alerts:** better alert pruning ([9144441](https://github.com/jordanlambrecht/tracker-tracker/commit/914444111deddf313c0295b81056c20eda12a983))
- **api:** clamp returned ints ([a1b4409](https://github.com/jordanlambrecht/tracker-tracker/commit/a1b4409a241863b0643fc1aa7eb080073d27e66c))
- **auth:** auth status projection ([9a69d49](https://github.com/jordanlambrecht/tracker-tracker/commit/9a69d49f95873ac772b004cefe5dfb7062bc9e58))
- **auth:** login parallelizationismer ([3a91b03](https://github.com/jordanlambrecht/tracker-tracker/commit/3a91b03a47cfacf216d31f68eb9b2df33bb44712))
- **auth:** parallel queries ([99175d5](https://github.com/jordanlambrecht/tracker-tracker/commit/99175d54ad79f26b4b32caec7e64541834f3e257))
- batch-fetch heartbeat clients, skip writes when healthy, merge deep poll UPDATEs ([2e77cbc](https://github.com/jordanlambrecht/tracker-tracker/commit/2e77cbc9c785a5f1a078f8665a8310d9483ba309))
- bg blur on dialog open was sexy but caused too much lag ([2780d5e](https://github.com/jordanlambrecht/tracker-tracker/commit/2780d5e03a568a5e16f1b176b61bd50ee92c6690))
- **charts:** disabled animation for `FleetSizeJitter` and `ParallelTorrentsChart` ([071d197](https://github.com/jordanlambrecht/tracker-tracker/commit/071d197113b63b81bd90eb5ef2001a5f5083ed03))
- clear timer on unmount ([95024aa](https://github.com/jordanlambrecht/tracker-tracker/commit/95024aa1f2bdd9bbe00cdcc49845e4ff19fa1aa3))
- column projections for poll cycle and client routes ([a23eee1](https://github.com/jordanlambrecht/tracker-tracker/commit/a23eee100888f8b8a283b378b9ff8c0e0e217bb1))
- dashboard loader 3-query `Promise.all` ([bae70f0](https://github.com/jordanlambrecht/tracker-tracker/commit/bae70f0073906ae36da1b4420595e53f95f47ca5))
- **dashboard:** better query handling ([4e45f4d](https://github.com/jordanlambrecht/tracker-tracker/commit/4e45f4d3b47a28f2d8e28528d16622201ddc7a6e))
- **dashboard:** handle `PUT` request errors and resync dashboard settings ([ed66f70](https://github.com/jordanlambrecht/tracker-tracker/commit/ed66f7083a1e3a0a71b88849257445f31887e1fe))
- **dashboard:** simplified snapshot handling for detectRankChanges ([3c84c7e](https://github.com/jordanlambrecht/tracker-tracker/commit/3c84c7ed49dd91f004eafe73c7436629665304d7))
- **dashboard:** slimmed down dl client shape ([eb39124](https://github.com/jordanlambrecht/tracker-tracker/commit/eb39124a09ea0c63611fef28071aca635e245adb))
- **db:** create indexes for `tracker_snapshots` ([fc4f05e](https://github.com/jordanlambrecht/tracker-tracker/commit/fc4f05e414ddad33c8dc1c3a1e2d6576cdfb1061))
- dynamically import ChangelogContent ([ae47380](https://github.com/jordanlambrecht/tracker-tracker/commit/ae473804ddc9ad9826b37bd1bf0d8a976d9dd5c7))
- dynamically import DashboardSettingsSheet ([add5c23](https://github.com/jordanlambrecht/tracker-tracker/commit/add5c2332f930f76e1fb45617333e366337bbd94))
- dynamically import EmojiPicker ([d4132cf](https://github.com/jordanlambrecht/tracker-tracker/commit/d4132cf13dbf518d20f2effdabc89e30adf941c3))
- dynamically import QRCodeSVG ([6f31fdb](https://github.com/jordanlambrecht/tracker-tracker/commit/6f31fdba7b259d832de91020d8208e74a3024290))
- dynamically import TorrentAgeScatter3D ([d233542](https://github.com/jordanlambrecht/tracker-tracker/commit/d233542a1e0d5f28138c61ab6226cf575f65afc2))
- **events:** optimized pagination ([6939074](https://github.com/jordanlambrecht/tracker-tracker/commit/69390741b3c3fce2da4a44fe02aa78ce7d987a94))
- **fleet:** server-side aggregation, sync store reads, JSONB slimming ([a398ced](https://github.com/jordanlambrecht/tracker-tracker/commit/a398ced92f172d8e8c6bf5a04344795c531ca77b))
- guard flags to globalThis ([f144ec3](https://github.com/jordanlambrecht/tracker-tracker/commit/f144ec34d0bc436e18a0c3ecc08b25872e82da5b))
- improved query stability ([955cce3](https://github.com/jordanlambrecht/tracker-tracker/commit/955cce348964d4ad269e54da878df6c7af422fa4))
- memoize chart data transforms, lazy-load react-markdown ([252ca7d](https://github.com/jordanlambrecht/tracker-tracker/commit/252ca7df7da1abd029801ad4575075e445869298))
- optimize sortOrder update logic ([b2cea74](https://github.com/jordanlambrecht/tracker-tracker/commit/b2cea7496e25a741806e91a24ea54d25545602f3))
- parallelize backup queries and drop cachedTorrents ([7c57f10](https://github.com/jordanlambrecht/tracker-tracker/commit/7c57f10ee33bfc676c1104ba0b6533b6a0a38797))
- prevent unnecessary re-renders ([7616408](https://github.com/jordanlambrecht/tracker-tracker/commit/7616408726d97cedc4075195c65bfc077a10b0d7))
- readonly return type on speed cache ([91617e6](https://github.com/jordanlambrecht/tracker-tracker/commit/91617e61a04ea8b03bc354fd61d079a3cee3b54d))
- remove redundant sort ([86e8e31](https://github.com/jordanlambrecht/tracker-tracker/commit/86e8e311bdfc81deb5b8d09f64f209a4816d3baf))
- return updated tracker from `PATCH` instead of requiring follow-up `GET` ([1a14aab](https://github.com/jordanlambrecht/tracker-tracker/commit/1a14aab4612c55871e0286a2b8665681b188dea6))
- **schema:** add brin index on polledAt for clientSnapshots ([bb5e441](https://github.com/jordanlambrecht/tracker-tracker/commit/bb5e44131898478a670cd08b16237855449f914e))
- **settings:** migrate settings components to tanstack ([6f6030a](https://github.com/jordanlambrecht/tracker-tracker/commit/6f6030a80b1b88974046caf2a0e4ff67519c4092))
- slotContext cleanup ([d05fa26](https://github.com/jordanlambrecht/tracker-tracker/commit/d05fa2656cdfa461c7bf6eb9ad3db373f4430a6c))
- stable select reference ([fc32b3f](https://github.com/jordanlambrecht/tracker-tracker/commit/fc32b3ffb0e1931af1d63d6a30d8fc966b33952d))
- stop torrent polling on inactive tab, dedupe update check via TQ cache ([4a6f353](https://github.com/jordanlambrecht/tracker-tracker/commit/4a6f353b99016f104eabeda7270b01f5ca210e2c))
- streamline Mousehole URL validation in PATCH and POST functions ([011f725](https://github.com/jordanlambrecht/tracker-tracker/commit/011f725169c5828e7c4cf25d3b8487647f1982da))
- tab hoisting ([27e9a25](https://github.com/jordanlambrecht/tracker-tracker/commit/27e9a253bf2c8f6f1a9ce4c7ba984218b0f43f5d))
- **tag-groups:** batch tag-group save ([ee495d1](https://github.com/jordanlambrecht/tracker-tracker/commit/ee495d1685c961a36f6931ff5637c1f980ef2992))
- torrent filtering, tab hoisting, barrel import fix ([8c0bffd](https://github.com/jordanlambrecht/tracker-tracker/commit/8c0bffd6687d6fc2ae44c56fbe2476b31f4db562))
- torrentsTab component to use lazy loading for Card components ([6682219](https://github.com/jordanlambrecht/tracker-tracker/commit/66822190af290d9d2e5191947dc1c2024be60cca))
- **tracker-info-tab:** lazy markdown comp initialization ([420bf02](https://github.com/jordanlambrecht/tracker-tracker/commit/420bf02b7080155af6c75714da2eec19badadeaa))
- unmount debug dialog on close ([7387b95](https://github.com/jordanlambrecht/tracker-tracker/commit/7387b95ddb26baa9158fd372bf91bc04cefee184))
- useMemo for tracker theme colors ([a3ec1f4](https://github.com/jordanlambrecht/tracker-tracker/commit/a3ec1f498d695685144d4b95e1e4ee00bc1c4a6d))


### Refactoring

- add formatRatioDisplay, formatCount, formatPercent, formatDateTime, hexToInt ([aa47790](https://github.com/jordanlambrecht/tracker-tracker/commit/aa4779079141afb49022068456f18faa14fcc1bf))
- add useMemo for crossSeedTags ([8355e72](https://github.com/jordanlambrecht/tracker-tracker/commit/8355e72389c6205d851f9a9316539ecdb4c5f06a))
- better error handling in settings comps ([fed8fe8](https://github.com/jordanlambrecht/tracker-tracker/commit/fed8fe8d76ae9412ec33fb0d000606b45b96f965))
- better notification/torrent handling, add type guards, and improve security checks ([80eb425](https://github.com/jordanlambrecht/tracker-tracker/commit/80eb4259828f19782a4183ca4886f40a8778aa33))
- buttons! ([d26656a](https://github.com/jordanlambrecht/tracker-tracker/commit/d26656a50f1740d5800d2bc3bac1ce75d9759d20))
- collapsed card headers into card component ([1858308](https://github.com/jordanlambrecht/tracker-tracker/commit/1858308a669407504ac84686a8f1b9666eaac09f))
- constants and shared helpers ([6d3da91](https://github.com/jordanlambrecht/tracker-tracker/commit/6d3da91708f9ab0c66c2854e42509ad685174c61))
- download client adapter system in prep for rtorrent ([c751b6e](https://github.com/jordanlambrecht/tracker-tracker/commit/c751b6e8240172782a1cd256f09b60c2ecea4d63))
- download client adapter system in prep for rtorrent ([6130e55](https://github.com/jordanlambrecht/tracker-tracker/commit/6130e553b44a9943812e152e5bb8ce117f9247c5))
- eliminate fleetTorrentsResponse, export discordEmbed, add parseThresholds ([5d5a5cc](https://github.com/jordanlambrecht/tracker-tracker/commit/5d5a5ccf800e58e99bf92ec55b3ec1eeba547c67))
- enhance backup history retrieval ([deb6360](https://github.com/jordanlambrecht/tracker-tracker/commit/deb6360f3d874031884911a638476415e11e6eb3))
- extract DayRange, DeltaDisplay, API response types ([a6df957](https://github.com/jordanlambrecht/tracker-tracker/commit/a6df9578addb7c28458098e3fd554cec8d820fbf))
- extract more props ([bea7e2e](https://github.com/jordanlambrecht/tracker-tracker/commit/bea7e2e37a10d0b5da6354f7f1fa6aba02950f1b))
- helpers, validators, and formatters oh my ([6e750d2](https://github.com/jordanlambrecht/tracker-tracker/commit/6e750d2494ad7e27b9680f4d53832d6dc1017c60))
- helpers, validators, and formatters oh my pt 2 ([de90cd4](https://github.com/jordanlambrecht/tracker-tracker/commit/de90cd43a12af780b7908b2c929222f94d3a2b7e))
- helpers, validators, and formatters oh my pt 3 ([41f03d8](https://github.com/jordanlambrecht/tracker-tracker/commit/41f03d85e66c62b1d60558f06ac4c58b21e1de88))
- helpers, validators, and formatters oh my pt 4 ([5fef730](https://github.com/jordanlambrecht/tracker-tracker/commit/5fef7308988f0f67b5f3f544165857085879bb55))
- improve mount logic ([08c2f6e](https://github.com/jordanlambrecht/tracker-tracker/commit/08c2f6ec66f1d67758c89f6cfc0983ad7320ffe9))
- lots of hook extractions ([d9a7834](https://github.com/jordanlambrecht/tracker-tracker/commit/d9a7834bd47e5e3aba9d85ddec722aa75e3a1159))
- make routeContext type ([c2979fd](https://github.com/jordanlambrecht/tracker-tracker/commit/c2979fd004561d6af353d19c66c6452c7ae91fe4))
- migrate interactive surfaces to nm-interactive classes ([ef3979a](https://github.com/jordanlambrecht/tracker-tracker/commit/ef3979a7d9dcd2419521a4780cf70c65088b3b42))
- named Drizzle type aliases ([684f758](https://github.com/jordanlambrecht/tracker-tracker/commit/684f7582aede03333df74ddba9d883dea060b310))
- new DataCell component ([0171372](https://github.com/jordanlambrecht/tracker-tracker/commit/017137250386f7976340ece8667b92304cef74cf))
- new SlotLabel component ([fb20902](https://github.com/jordanlambrecht/tracker-tracker/commit/fb20902e292594f2f6afe8f18b41f1a8090e8c8e))
- notificationTarget and downloadClient ([6400e33](https://github.com/jordanlambrecht/tracker-tracker/commit/6400e33a903b1575d4c0aa365d3372699987aba6))
- optimize polling logic ([cb75800](https://github.com/jordanlambrecht/tracker-tracker/commit/cb75800def97802edcd3d1537e1bb308fbfebfbe))
- qbt delta sync migration (wow) ([5150fbf](https://github.com/jordanlambrecht/tracker-tracker/commit/5150fbf9381d7bcfabd781d5819f3e562063f1ba))
- replace hex color regex with isValidHex ([90003b8](https://github.com/jordanlambrecht/tracker-tracker/commit/90003b83ed19d3c59291ecf8e904c5a3bed85d59))
- replace inline formatting with centralized formatters ([813aaeb](https://github.com/jordanlambrecht/tracker-tracker/commit/813aaebffac1991c101ffa3843a1e7327ebf6d26))
- replace manual data fetching with react-query ([a07d62c](https://github.com/jordanlambrecht/tracker-tracker/commit/a07d62c9231285186dfb307d750b56da6847f331))
- **sheets:** simplified dialog handling ([459beee](https://github.com/jordanlambrecht/tracker-tracker/commit/459beee4039674f3c63a16b06d2824b50b328023))
- silence logging for non-critical errors ([ce33279](https://github.com/jordanlambrecht/tracker-tracker/commit/ce332794b79b95605db8db2cfe9b87ec1968e9ed))
- slimmed down sidebar ([92151f0](https://github.com/jordanlambrecht/tracker-tracker/commit/92151f06adc55775909ebda61efd33950ed4e6c4))
- swap buttons with saveDiscardBar in settings ([fcfb33c](https://github.com/jordanlambrecht/tracker-tracker/commit/fcfb33c715dc244bc811a00f95692438bf8ab0fb))
- switched a lot of stuff to clsx and cva ([462ea57](https://github.com/jordanlambrecht/tracker-tracker/commit/462ea57daf79f2d51efb44c1543dc3de591fdee7))
- switched to node-html-parser ([e8b7728](https://github.com/jordanlambrecht/tracker-tracker/commit/e8b77286aea80be21654dbe79652e0892fbc5236))
- type alert pruning ([0c1cbf3](https://github.com/jordanlambrecht/tracker-tracker/commit/0c1cbf306fd9419f52606ff8083016f2ed454174))
- type parsePlatformMeta return as PlatformMeta union, fix bigint optional chaining ([6bdf5dd](https://github.com/jordanlambrecht/tracker-tracker/commit/6bdf5ddd2253785c3b16e35430472ba04d0cea1e))
- **typography:** replace inline label spans with H2 component ([8003d72](https://github.com/jordanlambrecht/tracker-tracker/commit/8003d72b4cc3752f591756b78972b3723760190a))
- unified text sizes ([1b6080e](https://github.com/jordanlambrecht/tracker-tracker/commit/1b6080e4c74273e426d88ca9174ec366ec2d079e))
- update action status terminology from "testing" to "pending" ([42f8f81](https://github.com/jordanlambrecht/tracker-tracker/commit/42f8f8198bb38c13298291f6492fd960017804fd))
- update chart color constants to use theme colors ([1951931](https://github.com/jordanlambrecht/tracker-tracker/commit/19519311ced3491855ed584043d161f0dd368ad0))
- update notification circuit breaker state handling ([c36a0bd](https://github.com/jordanlambrecht/tracker-tracker/commit/c36a0bd1bcca5f009f6ec38e7aff475655f18fd6))

## [2.7.3](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.6.0...v2.7.3) (2026-03-31)


### Features

- add AvistaZ slots for activity and badges ([f4ba2e4](https://github.com/jordanlambrecht/tracker-tracker/commit/f4ba2e4dc530d75a7c14c87e202568a4905bdd34))
- add ConfirmRemove and SaveDiscardBar components ([01b3ee5](https://github.com/jordanlambrecht/tracker-tracker/commit/01b3ee5374f356822a4e6b14970f01666e865e85))
- add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext ([8f94cac](https://github.com/jordanlambrecht/tracker-tracker/commit/8f94caca9ef4dddb666bf27787725d099ef8cd1a))
- add hint support to Input component and update BackupsSection to use it ([91af8f0](https://github.com/jordanlambrecht/tracker-tracker/commit/91af8f00a2fbc1e020f92b054e945ee49fc822aa))
- add lazy loading support to Card component ([8e6be1f](https://github.com/jordanlambrecht/tracker-tracker/commit/8e6be1f9f6a65278be7ec78ddce1590553966de9))
- add searchParams handling and initialTab prop to TrackerDetailPage ([b32cb9c](https://github.com/jordanlambrecht/tracker-tracker/commit/b32cb9c0ae502ead5f4613ae59480c6e75a979aa))
- add support for luminarr and darkPeers (closes [#113](https://github.com/jordanlambrecht/tracker-tracker/issues/113) and [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114)) ([fe2bea2](https://github.com/jordanlambrecht/tracker-tracker/commit/fe2bea23597b862de4b3f979e7b48bf89f780a6a))
- added confirmAction ui comp ([0b0de15](https://github.com/jordanlambrecht/tracker-tracker/commit/0b0de158b56f705ec05babb1b2f9ac42d97a8752))
- added support for the avistaz network (closes [#112](https://github.com/jordanlambrecht/tracker-tracker/issues/112)) ([ad3ad57](https://github.com/jordanlambrecht/tracker-tracker/commit/ad3ad57a14e1d302c468350f2a254a192b893ae2))
- beefed up Dialog component ([b329e26](https://github.com/jordanlambrecht/tracker-tracker/commit/b329e264a9f83f8f92441a22ac337bb295f5c289))
- extend change-password API to handle notification target re-encryption ([588a0ad](https://github.com/jordanlambrecht/tracker-tracker/commit/588a0ad2b3d2078427f0692c73053cee9b637481))
- implement SectionToggle and ProgressWidget components ([640e517](https://github.com/jordanlambrecht/tracker-tracker/commit/640e517652a6bb151374f30e24a026f42e1ab5e9))
- implement useActionStatus hook for managing action states ([710b7b1](https://github.com/jordanlambrecht/tracker-tracker/commit/710b7b1ac83237bfc8bcfabf711b649ddc17cc1e))
- new formatSpeed formatter ([4ec91a2](https://github.com/jordanlambrecht/tracker-tracker/commit/4ec91a2e65628b660985d4f0fa005fe84a2b85b4))
- new heatmap in torrent fleet on dashboard! ([829973d](https://github.com/jordanlambrecht/tracker-tracker/commit/829973d159289a93f4392385b14b5b69f5d077eb))
- new info tip icon system thing ([d865622](https://github.com/jordanlambrecht/tracker-tracker/commit/d865622c977e57a7952805f4701e29d6b109d182))
- new notice component ([d9c700d](https://github.com/jordanlambrecht/tracker-tracker/commit/d9c700d772e5dcdd507bf6102079ef4f48fedbeb))
- new skeleton loaders ([f9a7054](https://github.com/jordanlambrecht/tracker-tracker/commit/f9a7054a9bd3f140efab3b9ca326e19f9e5561ee))
- new useAnimatedPresence and useEscapeKey hooks ([02fc0f8](https://github.com/jordanlambrecht/tracker-tracker/commit/02fc0f87217a8e9b7622d163bb014744191bd6b5))
- parseIntClamped ([42b4c25](https://github.com/jordanlambrecht/tracker-tracker/commit/42b4c254ce8d67379e4a30f0220b1176f5ee4cdd))
- refactor dirty detection to buildPatch function ([b7e49f3](https://github.com/jordanlambrecht/tracker-tracker/commit/b7e49f3d1e36424a443292b43893cdbec9b460dd))
- removed gravatar fluff ([cb87cda](https://github.com/jordanlambrecht/tracker-tracker/commit/cb87cda8cc0340dece54802101c3270aa0fab7ac))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([e593117](https://github.com/jordanlambrecht/tracker-tracker/commit/e593117f9d0021b94a7d06fcd3f8dd8a5eb42cde))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([cd5f957](https://github.com/jordanlambrecht/tracker-tracker/commit/cd5f957efa3ffca57aa25698c3bc84b529b1e478))
- **trackers:** details for digitalcore and luminarr (thanks @DGeyzer) ([b3b621b](https://github.com/jordanlambrecht/tracker-tracker/commit/b3b621b1f44b77af28d1b35ef2b55d528c7cafa7))
- **trackers:** update user classes requirements for animez tracker ([3c41fc5](https://github.com/jordanlambrecht/tracker-tracker/commit/3c41fc54fa15549d57a93b839b851d4f000fb114))
- useCrudCard hook ([5a89c58](https://github.com/jordanlambrecht/tracker-tracker/commit/5a89c58cb9837da6b9ff140ebec72551cb9d339e))


### Bug Fixes

-  avistaZ platform-based trackers not fetching user avatars ([e7fe1df](https://github.com/jordanlambrecht/tracker-tracker/commit/e7fe1df4fa376b9041558fabb6c60022c591fcad))
- add notice for TOTP disabled during backup restore ([a603b35](https://github.com/jordanlambrecht/tracker-tracker/commit/a603b35aae1293dd75afcce19f01150fc8b36a90))
- add tabIndex to InfoTip ([fe4b46a](https://github.com/jordanlambrecht/tracker-tracker/commit/fe4b46a272ebb761f3bed2ce6a777735272d8aa7))
- bad styling ([748b851](https://github.com/jordanlambrecht/tracker-tracker/commit/748b851c5b0fff1f6e77586d1d22cac4d11ad0b3))
- better error handling for setup response messages ([bf7645a](https://github.com/jordanlambrecht/tracker-tracker/commit/bf7645a908322f4800416253e39a73ac594baf52))
- boundaryGap bug on charts ([8b1edc7](https://github.com/jordanlambrecht/tracker-tracker/commit/8b1edc7ce744d4cf61d89469fc3c9be5b29ed4d7))
- chart content not hiding on card collapse (closes [#34](https://github.com/jordanlambrecht/tracker-tracker/issues/34)) ([d29e391](https://github.com/jordanlambrecht/tracker-tracker/commit/d29e391be05ce063220b435e89d2474db2080772))
- don't show editable user joined date for avistaz platform ([e0884d7](https://github.com/jordanlambrecht/tracker-tracker/commit/e0884d723de87e3263954f86a5c4eb655e3efb47))
- duplicate TrackerSummary export ([0d79466](https://github.com/jordanlambrecht/tracker-tracker/commit/0d794667908fa5d47f0079dc995fd85f3cbacd22))
- enforce character limits on proxy username, password, and mousehole URL ([8debdd2](https://github.com/jordanlambrecht/tracker-tracker/commit/8debdd28164ca854a150722133d9830630e009ef))
- ensure default value reference is used in useLocalStorage hook ([4cf6dba](https://github.com/jordanlambrecht/tracker-tracker/commit/4cf6dba6ae776fdcf7eaa8acb9b78694590c7bf2))
- ensure loading state is reset after API calls in AddTrackerDialog ([a971c64](https://github.com/jordanlambrecht/tracker-tracker/commit/a971c64f67d279f82a5c2645c87f03133474f554))
- improve error handling in backup password operations ([11c303a](https://github.com/jordanlambrecht/tracker-tracker/commit/11c303a539b24c552b40ffe909e74b71f6e27804))
- json parsing error ([d140679](https://github.com/jordanlambrecht/tracker-tracker/commit/d14067920d129847181d498f3044d0cbc1cc0c90))
- make footer logo load eagerly ([fd9b6fa](https://github.com/jordanlambrecht/tracker-tracker/commit/fd9b6fa3ac2e55bf24338888352c559bee7fd144))
- make nextjs happy with image components ([826c566](https://github.com/jordanlambrecht/tracker-tracker/commit/826c56696f0116691f2e068f5a701ebc95f3be78))
- make validateHttpUrl function use dynamic error labels ([49482ba](https://github.com/jordanlambrecht/tracker-tracker/commit/49482ba2a90193a7f5f8bbe7bf7448e5d6dea0a8))
- minor placeholder bug ([9f8606b](https://github.com/jordanlambrecht/tracker-tracker/commit/9f8606b62cd05727ede0088132e2315fc101c5b5))
- minor stuff ([ca6496d](https://github.com/jordanlambrecht/tracker-tracker/commit/ca6496d7f12859148f62254ba8d1e8112e530387))
- oops ([fe9e801](https://github.com/jordanlambrecht/tracker-tracker/commit/fe9e801c5261d9e183a215b1a4072b544bd14e24))
- oops 2 ([f5a0d1a](https://github.com/jordanlambrecht/tracker-tracker/commit/f5a0d1aa9dcfe4a59bd2e9a098b0768ef42b1a4d))
- optimize database queries ([56ee982](https://github.com/jordanlambrecht/tracker-tracker/commit/56ee9829925c6edf0332afa1bda3e0dbed3b2481))
- optimize deletion of old checkpoints ([32a177d](https://github.com/jordanlambrecht/tracker-tracker/commit/32a177d75d4f652d3e7737dafe3324b122e0b6c9))
- persist showTodayAtAGlance setting, serialize dates ([f95f56c](https://github.com/jordanlambrecht/tracker-tracker/commit/f95f56c9c83fd5da10e779ad337f3ddf4715ebd0))
- remove unused import ([b454085](https://github.com/jordanlambrecht/tracker-tracker/commit/b454085a386dec9df8dc0d95427f0f650bf4d726))
- removed unnecessary lazy loading from Elder Torrents section ([35e3caa](https://github.com/jordanlambrecht/tracker-tracker/commit/35e3caa1e692eb4b498409b622069e62951a789e))
- replace useEffect with useLayoutEffect ([4dd01ad](https://github.com/jordanlambrecht/tracker-tracker/commit/4dd01ad8cb02ca3e713432dc3658a75a68053811))
- simplify shouldMount logic in ChartCard component ([673ed48](https://github.com/jordanlambrecht/tracker-tracker/commit/673ed483b38afb83968f58375fe65e04ad93c941))
- unify error handling in SetupForm ([7aec2ee](https://github.com/jordanlambrecht/tracker-tracker/commit/7aec2ee742e73dc9682cdf7c90e7a772fea3fda8))
- use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants ([f847941](https://github.com/jordanlambrecht/tracker-tracker/commit/f847941b7effd2d0f4b8abeab185f3ae703262d9))
- wrong Content-Type for cached avatar images ([ca9e1fa](https://github.com/jordanlambrecht/tracker-tracker/commit/ca9e1fa3a5217c6aeb1c6a95098436306a8879fb))
- x-axis was showing wrong values, zoom bug ([b6eea34](https://github.com/jordanlambrecht/tracker-tracker/commit/b6eea3499dcd050162ceca0e6ba2a94fc0a2b15e))


### Performance

- bg blur on dialog open was sexy but caused too much lag ([2780d5e](https://github.com/jordanlambrecht/tracker-tracker/commit/2780d5e03a568a5e16f1b176b61bd50ee92c6690))
- clear timer on unmount ([95024aa](https://github.com/jordanlambrecht/tracker-tracker/commit/95024aa1f2bdd9bbe00cdcc49845e4ff19fa1aa3))
- dynamically import ChangelogContent ([ae47380](https://github.com/jordanlambrecht/tracker-tracker/commit/ae473804ddc9ad9826b37bd1bf0d8a976d9dd5c7))
- dynamically import DashboardSettingsSheet ([add5c23](https://github.com/jordanlambrecht/tracker-tracker/commit/add5c2332f930f76e1fb45617333e366337bbd94))
- dynamically import EmojiPicker ([d4132cf](https://github.com/jordanlambrecht/tracker-tracker/commit/d4132cf13dbf518d20f2effdabc89e30adf941c3))
- dynamically import QRCodeSVG ([6f31fdb](https://github.com/jordanlambrecht/tracker-tracker/commit/6f31fdba7b259d832de91020d8208e74a3024290))
- dynamically import TorrentAgeScatter3D ([d233542](https://github.com/jordanlambrecht/tracker-tracker/commit/d233542a1e0d5f28138c61ab6226cf575f65afc2))
- improved query stability ([955cce3](https://github.com/jordanlambrecht/tracker-tracker/commit/955cce348964d4ad269e54da878df6c7af422fa4))
- optimize sortOrder update logic ([b2cea74](https://github.com/jordanlambrecht/tracker-tracker/commit/b2cea7496e25a741806e91a24ea54d25545602f3))
- prevent unnecessary re-renders ([7616408](https://github.com/jordanlambrecht/tracker-tracker/commit/7616408726d97cedc4075195c65bfc077a10b0d7))
- streamline Mousehole URL validation in PATCH and POST functions ([011f725](https://github.com/jordanlambrecht/tracker-tracker/commit/011f725169c5828e7c4cf25d3b8487647f1982da))
- torrentsTab component to use lazy loading for Card components ([6682219](https://github.com/jordanlambrecht/tracker-tracker/commit/66822190af290d9d2e5191947dc1c2024be60cca))


### Refactoring

- add formatRatioDisplay, formatCount, formatPercent, formatDateTime, hexToInt ([aa47790](https://github.com/jordanlambrecht/tracker-tracker/commit/aa4779079141afb49022068456f18faa14fcc1bf))
- add useMemo for crossSeedTags ([8355e72](https://github.com/jordanlambrecht/tracker-tracker/commit/8355e72389c6205d851f9a9316539ecdb4c5f06a))
- better error handling in settings comps ([fed8fe8](https://github.com/jordanlambrecht/tracker-tracker/commit/fed8fe8d76ae9412ec33fb0d000606b45b96f965))
- better notification/torrent handling, add type guards, and improve security checks ([80eb425](https://github.com/jordanlambrecht/tracker-tracker/commit/80eb4259828f19782a4183ca4886f40a8778aa33))
- buttons! ([d26656a](https://github.com/jordanlambrecht/tracker-tracker/commit/d26656a50f1740d5800d2bc3bac1ce75d9759d20))
- collapsed card headers into card component ([1858308](https://github.com/jordanlambrecht/tracker-tracker/commit/1858308a669407504ac84686a8f1b9666eaac09f))
- eliminate fleetTorrentsResponse, export discordEmbed, add parseThresholds ([5d5a5cc](https://github.com/jordanlambrecht/tracker-tracker/commit/5d5a5ccf800e58e99bf92ec55b3ec1eeba547c67))
- enhance backup history retrieval ([deb6360](https://github.com/jordanlambrecht/tracker-tracker/commit/deb6360f3d874031884911a638476415e11e6eb3))
- extract DayRange, DeltaDisplay, API response types ([a6df957](https://github.com/jordanlambrecht/tracker-tracker/commit/a6df9578addb7c28458098e3fd554cec8d820fbf))
- extract more props ([bea7e2e](https://github.com/jordanlambrecht/tracker-tracker/commit/bea7e2e37a10d0b5da6354f7f1fa6aba02950f1b))
- helpers, validators, and formatters oh my ([6e750d2](https://github.com/jordanlambrecht/tracker-tracker/commit/6e750d2494ad7e27b9680f4d53832d6dc1017c60))
- helpers, validators, and formatters oh my pt 2 ([de90cd4](https://github.com/jordanlambrecht/tracker-tracker/commit/de90cd43a12af780b7908b2c929222f94d3a2b7e))
- helpers, validators, and formatters oh my pt 3 ([41f03d8](https://github.com/jordanlambrecht/tracker-tracker/commit/41f03d85e66c62b1d60558f06ac4c58b21e1de88))
- helpers, validators, and formatters oh my pt 4 ([5fef730](https://github.com/jordanlambrecht/tracker-tracker/commit/5fef7308988f0f67b5f3f544165857085879bb55))
- improve mount logic ([08c2f6e](https://github.com/jordanlambrecht/tracker-tracker/commit/08c2f6ec66f1d67758c89f6cfc0983ad7320ffe9))
- lots of hook extractions ([d9a7834](https://github.com/jordanlambrecht/tracker-tracker/commit/d9a7834bd47e5e3aba9d85ddec722aa75e3a1159))
- make routeContext type ([c2979fd](https://github.com/jordanlambrecht/tracker-tracker/commit/c2979fd004561d6af353d19c66c6452c7ae91fe4))
- migrate interactive surfaces to nm-interactive classes ([ef3979a](https://github.com/jordanlambrecht/tracker-tracker/commit/ef3979a7d9dcd2419521a4780cf70c65088b3b42))
- named Drizzle type aliases ([684f758](https://github.com/jordanlambrecht/tracker-tracker/commit/684f7582aede03333df74ddba9d883dea060b310))
- new DataCell component ([0171372](https://github.com/jordanlambrecht/tracker-tracker/commit/017137250386f7976340ece8667b92304cef74cf))
- new SlotLabel component ([fb20902](https://github.com/jordanlambrecht/tracker-tracker/commit/fb20902e292594f2f6afe8f18b41f1a8090e8c8e))
- notificationTarget and downloadClient ([6400e33](https://github.com/jordanlambrecht/tracker-tracker/commit/6400e33a903b1575d4c0aa365d3372699987aba6))
- optimize polling logic ([cb75800](https://github.com/jordanlambrecht/tracker-tracker/commit/cb75800def97802edcd3d1537e1bb308fbfebfbe))
- qbt delta sync migration (wow) ([5150fbf](https://github.com/jordanlambrecht/tracker-tracker/commit/5150fbf9381d7bcfabd781d5819f3e562063f1ba))
- replace hex color regex with isValidHex ([90003b8](https://github.com/jordanlambrecht/tracker-tracker/commit/90003b83ed19d3c59291ecf8e904c5a3bed85d59))
- replace inline formatting with centralized formatters ([813aaeb](https://github.com/jordanlambrecht/tracker-tracker/commit/813aaebffac1991c101ffa3843a1e7327ebf6d26))
- replace manual data fetching with react-query ([a07d62c](https://github.com/jordanlambrecht/tracker-tracker/commit/a07d62c9231285186dfb307d750b56da6847f331))
- silence logging for non-critical errors ([ce33279](https://github.com/jordanlambrecht/tracker-tracker/commit/ce332794b79b95605db8db2cfe9b87ec1968e9ed))
- slimmed down sidebar ([92151f0](https://github.com/jordanlambrecht/tracker-tracker/commit/92151f06adc55775909ebda61efd33950ed4e6c4))
- swap buttons with saveDiscardBar in settings ([fcfb33c](https://github.com/jordanlambrecht/tracker-tracker/commit/fcfb33c715dc244bc811a00f95692438bf8ab0fb))
- switched a lot of stuff to clsx and cva ([462ea57](https://github.com/jordanlambrecht/tracker-tracker/commit/462ea57daf79f2d51efb44c1543dc3de591fdee7))
- switched to node-html-parser ([e8b7728](https://github.com/jordanlambrecht/tracker-tracker/commit/e8b77286aea80be21654dbe79652e0892fbc5236))
- type alert pruning ([0c1cbf3](https://github.com/jordanlambrecht/tracker-tracker/commit/0c1cbf306fd9419f52606ff8083016f2ed454174))
- type parsePlatformMeta return as PlatformMeta union, fix bigint optional chaining ([6bdf5dd](https://github.com/jordanlambrecht/tracker-tracker/commit/6bdf5ddd2253785c3b16e35430472ba04d0cea1e))
- **typography:** replace inline label spans with H2 component ([8003d72](https://github.com/jordanlambrecht/tracker-tracker/commit/8003d72b4cc3752f591756b78972b3723760190a))
- unified text sizes ([1b6080e](https://github.com/jordanlambrecht/tracker-tracker/commit/1b6080e4c74273e426d88ca9174ec366ec2d079e))
- update action status terminology from "testing" to "pending" ([42f8f81](https://github.com/jordanlambrecht/tracker-tracker/commit/42f8f8198bb38c13298291f6492fd960017804fd))
- update chart color constants to use theme colors ([1951931](https://github.com/jordanlambrecht/tracker-tracker/commit/19519311ced3491855ed584043d161f0dd368ad0))
- update notification circuit breaker state handling ([c36a0bd](https://github.com/jordanlambrecht/tracker-tracker/commit/c36a0bd1bcca5f009f6ec38e7aff475655f18fd6))

## [2.7.2](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.6.0...v2.7.2) (2026-03-31)


### Features

- add AvistaZ slots for activity and badges ([f4ba2e4](https://github.com/jordanlambrecht/tracker-tracker/commit/f4ba2e4dc530d75a7c14c87e202568a4905bdd34))
- add ConfirmRemove and SaveDiscardBar components ([01b3ee5](https://github.com/jordanlambrecht/tracker-tracker/commit/01b3ee5374f356822a4e6b14970f01666e865e85))
- add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext ([8f94cac](https://github.com/jordanlambrecht/tracker-tracker/commit/8f94caca9ef4dddb666bf27787725d099ef8cd1a))
- add hint support to Input component and update BackupsSection to use it ([91af8f0](https://github.com/jordanlambrecht/tracker-tracker/commit/91af8f00a2fbc1e020f92b054e945ee49fc822aa))
- add lazy loading support to Card component ([8e6be1f](https://github.com/jordanlambrecht/tracker-tracker/commit/8e6be1f9f6a65278be7ec78ddce1590553966de9))
- add searchParams handling and initialTab prop to TrackerDetailPage ([b32cb9c](https://github.com/jordanlambrecht/tracker-tracker/commit/b32cb9c0ae502ead5f4613ae59480c6e75a979aa))
- add support for luminarr and darkPeers (closes [#113](https://github.com/jordanlambrecht/tracker-tracker/issues/113) and [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114)) ([fe2bea2](https://github.com/jordanlambrecht/tracker-tracker/commit/fe2bea23597b862de4b3f979e7b48bf89f780a6a))
- added confirmAction ui comp ([0b0de15](https://github.com/jordanlambrecht/tracker-tracker/commit/0b0de158b56f705ec05babb1b2f9ac42d97a8752))
- added support for the avistaz network (closes [#112](https://github.com/jordanlambrecht/tracker-tracker/issues/112)) ([ad3ad57](https://github.com/jordanlambrecht/tracker-tracker/commit/ad3ad57a14e1d302c468350f2a254a192b893ae2))
- beefed up Dialog component ([b329e26](https://github.com/jordanlambrecht/tracker-tracker/commit/b329e264a9f83f8f92441a22ac337bb295f5c289))
- extend change-password API to handle notification target re-encryption ([588a0ad](https://github.com/jordanlambrecht/tracker-tracker/commit/588a0ad2b3d2078427f0692c73053cee9b637481))
- implement SectionToggle and ProgressWidget components ([640e517](https://github.com/jordanlambrecht/tracker-tracker/commit/640e517652a6bb151374f30e24a026f42e1ab5e9))
- implement useActionStatus hook for managing action states ([710b7b1](https://github.com/jordanlambrecht/tracker-tracker/commit/710b7b1ac83237bfc8bcfabf711b649ddc17cc1e))
- new formatSpeed formatter ([4ec91a2](https://github.com/jordanlambrecht/tracker-tracker/commit/4ec91a2e65628b660985d4f0fa005fe84a2b85b4))
- new heatmap in torrent fleet on dashboard! ([829973d](https://github.com/jordanlambrecht/tracker-tracker/commit/829973d159289a93f4392385b14b5b69f5d077eb))
- new info tip icon system thing ([d865622](https://github.com/jordanlambrecht/tracker-tracker/commit/d865622c977e57a7952805f4701e29d6b109d182))
- new notice component ([d9c700d](https://github.com/jordanlambrecht/tracker-tracker/commit/d9c700d772e5dcdd507bf6102079ef4f48fedbeb))
- new skeleton loaders ([f9a7054](https://github.com/jordanlambrecht/tracker-tracker/commit/f9a7054a9bd3f140efab3b9ca326e19f9e5561ee))
- new useAnimatedPresence and useEscapeKey hooks ([02fc0f8](https://github.com/jordanlambrecht/tracker-tracker/commit/02fc0f87217a8e9b7622d163bb014744191bd6b5))
- parseIntClamped ([42b4c25](https://github.com/jordanlambrecht/tracker-tracker/commit/42b4c254ce8d67379e4a30f0220b1176f5ee4cdd))
- refactor dirty detection to buildPatch function ([b7e49f3](https://github.com/jordanlambrecht/tracker-tracker/commit/b7e49f3d1e36424a443292b43893cdbec9b460dd))
- removed gravatar fluff ([cb87cda](https://github.com/jordanlambrecht/tracker-tracker/commit/cb87cda8cc0340dece54802101c3270aa0fab7ac))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([e593117](https://github.com/jordanlambrecht/tracker-tracker/commit/e593117f9d0021b94a7d06fcd3f8dd8a5eb42cde))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([cd5f957](https://github.com/jordanlambrecht/tracker-tracker/commit/cd5f957efa3ffca57aa25698c3bc84b529b1e478))
- **trackers:** details for digitalcore and luminarr (thanks @DGeyzer) ([b3b621b](https://github.com/jordanlambrecht/tracker-tracker/commit/b3b621b1f44b77af28d1b35ef2b55d528c7cafa7))
- useCrudCard hook ([5a89c58](https://github.com/jordanlambrecht/tracker-tracker/commit/5a89c58cb9837da6b9ff140ebec72551cb9d339e))


### Bug Fixes

-  avistaZ platform-based trackers not fetching user avatars ([e7fe1df](https://github.com/jordanlambrecht/tracker-tracker/commit/e7fe1df4fa376b9041558fabb6c60022c591fcad))
- add notice for TOTP disabled during backup restore ([a603b35](https://github.com/jordanlambrecht/tracker-tracker/commit/a603b35aae1293dd75afcce19f01150fc8b36a90))
- add tabIndex to InfoTip ([fe4b46a](https://github.com/jordanlambrecht/tracker-tracker/commit/fe4b46a272ebb761f3bed2ce6a777735272d8aa7))
- bad styling ([748b851](https://github.com/jordanlambrecht/tracker-tracker/commit/748b851c5b0fff1f6e77586d1d22cac4d11ad0b3))
- better error handling for setup response messages ([bf7645a](https://github.com/jordanlambrecht/tracker-tracker/commit/bf7645a908322f4800416253e39a73ac594baf52))
- boundaryGap bug on charts ([8b1edc7](https://github.com/jordanlambrecht/tracker-tracker/commit/8b1edc7ce744d4cf61d89469fc3c9be5b29ed4d7))
- chart content not hiding on card collapse (closes [#34](https://github.com/jordanlambrecht/tracker-tracker/issues/34)) ([d29e391](https://github.com/jordanlambrecht/tracker-tracker/commit/d29e391be05ce063220b435e89d2474db2080772))
- don't show editable user joined date for avistaz platform ([e0884d7](https://github.com/jordanlambrecht/tracker-tracker/commit/e0884d723de87e3263954f86a5c4eb655e3efb47))
- duplicate TrackerSummary export ([0d79466](https://github.com/jordanlambrecht/tracker-tracker/commit/0d794667908fa5d47f0079dc995fd85f3cbacd22))
- enforce character limits on proxy username, password, and mousehole URL ([8debdd2](https://github.com/jordanlambrecht/tracker-tracker/commit/8debdd28164ca854a150722133d9830630e009ef))
- ensure default value reference is used in useLocalStorage hook ([4cf6dba](https://github.com/jordanlambrecht/tracker-tracker/commit/4cf6dba6ae776fdcf7eaa8acb9b78694590c7bf2))
- ensure loading state is reset after API calls in AddTrackerDialog ([a971c64](https://github.com/jordanlambrecht/tracker-tracker/commit/a971c64f67d279f82a5c2645c87f03133474f554))
- improve error handling in backup password operations ([11c303a](https://github.com/jordanlambrecht/tracker-tracker/commit/11c303a539b24c552b40ffe909e74b71f6e27804))
- json parsing error ([d140679](https://github.com/jordanlambrecht/tracker-tracker/commit/d14067920d129847181d498f3044d0cbc1cc0c90))
- make footer logo load eagerly ([fd9b6fa](https://github.com/jordanlambrecht/tracker-tracker/commit/fd9b6fa3ac2e55bf24338888352c559bee7fd144))
- make nextjs happy with image components ([826c566](https://github.com/jordanlambrecht/tracker-tracker/commit/826c56696f0116691f2e068f5a701ebc95f3be78))
- make validateHttpUrl function use dynamic error labels ([49482ba](https://github.com/jordanlambrecht/tracker-tracker/commit/49482ba2a90193a7f5f8bbe7bf7448e5d6dea0a8))
- minor placeholder bug ([9f8606b](https://github.com/jordanlambrecht/tracker-tracker/commit/9f8606b62cd05727ede0088132e2315fc101c5b5))
- minor stuff ([ca6496d](https://github.com/jordanlambrecht/tracker-tracker/commit/ca6496d7f12859148f62254ba8d1e8112e530387))
- oops ([fe9e801](https://github.com/jordanlambrecht/tracker-tracker/commit/fe9e801c5261d9e183a215b1a4072b544bd14e24))
- oops 2 ([f5a0d1a](https://github.com/jordanlambrecht/tracker-tracker/commit/f5a0d1aa9dcfe4a59bd2e9a098b0768ef42b1a4d))
- optimize database queries ([56ee982](https://github.com/jordanlambrecht/tracker-tracker/commit/56ee9829925c6edf0332afa1bda3e0dbed3b2481))
- optimize deletion of old checkpoints ([32a177d](https://github.com/jordanlambrecht/tracker-tracker/commit/32a177d75d4f652d3e7737dafe3324b122e0b6c9))
- persist showTodayAtAGlance setting, serialize dates ([f95f56c](https://github.com/jordanlambrecht/tracker-tracker/commit/f95f56c9c83fd5da10e779ad337f3ddf4715ebd0))
- remove unused import ([b454085](https://github.com/jordanlambrecht/tracker-tracker/commit/b454085a386dec9df8dc0d95427f0f650bf4d726))
- removed unnecessary lazy loading from Elder Torrents section ([35e3caa](https://github.com/jordanlambrecht/tracker-tracker/commit/35e3caa1e692eb4b498409b622069e62951a789e))
- replace useEffect with useLayoutEffect ([4dd01ad](https://github.com/jordanlambrecht/tracker-tracker/commit/4dd01ad8cb02ca3e713432dc3658a75a68053811))
- simplify shouldMount logic in ChartCard component ([673ed48](https://github.com/jordanlambrecht/tracker-tracker/commit/673ed483b38afb83968f58375fe65e04ad93c941))
- unify error handling in SetupForm ([7aec2ee](https://github.com/jordanlambrecht/tracker-tracker/commit/7aec2ee742e73dc9682cdf7c90e7a772fea3fda8))
- use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants ([f847941](https://github.com/jordanlambrecht/tracker-tracker/commit/f847941b7effd2d0f4b8abeab185f3ae703262d9))
- wrong Content-Type for cached avatar images ([ca9e1fa](https://github.com/jordanlambrecht/tracker-tracker/commit/ca9e1fa3a5217c6aeb1c6a95098436306a8879fb))
- x-axis was showing wrong values, zoom bug ([b6eea34](https://github.com/jordanlambrecht/tracker-tracker/commit/b6eea3499dcd050162ceca0e6ba2a94fc0a2b15e))


### Performance

- bg blur on dialog open was sexy but caused too much lag ([2780d5e](https://github.com/jordanlambrecht/tracker-tracker/commit/2780d5e03a568a5e16f1b176b61bd50ee92c6690))
- clear timer on unmount ([95024aa](https://github.com/jordanlambrecht/tracker-tracker/commit/95024aa1f2bdd9bbe00cdcc49845e4ff19fa1aa3))
- dynamically import ChangelogContent ([ae47380](https://github.com/jordanlambrecht/tracker-tracker/commit/ae473804ddc9ad9826b37bd1bf0d8a976d9dd5c7))
- dynamically import DashboardSettingsSheet ([add5c23](https://github.com/jordanlambrecht/tracker-tracker/commit/add5c2332f930f76e1fb45617333e366337bbd94))
- dynamically import EmojiPicker ([d4132cf](https://github.com/jordanlambrecht/tracker-tracker/commit/d4132cf13dbf518d20f2effdabc89e30adf941c3))
- dynamically import QRCodeSVG ([6f31fdb](https://github.com/jordanlambrecht/tracker-tracker/commit/6f31fdba7b259d832de91020d8208e74a3024290))
- dynamically import TorrentAgeScatter3D ([d233542](https://github.com/jordanlambrecht/tracker-tracker/commit/d233542a1e0d5f28138c61ab6226cf575f65afc2))
- improved query stability ([955cce3](https://github.com/jordanlambrecht/tracker-tracker/commit/955cce348964d4ad269e54da878df6c7af422fa4))
- optimize sortOrder update logic ([b2cea74](https://github.com/jordanlambrecht/tracker-tracker/commit/b2cea7496e25a741806e91a24ea54d25545602f3))
- prevent unnecessary re-renders ([7616408](https://github.com/jordanlambrecht/tracker-tracker/commit/7616408726d97cedc4075195c65bfc077a10b0d7))
- streamline Mousehole URL validation in PATCH and POST functions ([011f725](https://github.com/jordanlambrecht/tracker-tracker/commit/011f725169c5828e7c4cf25d3b8487647f1982da))
- torrentsTab component to use lazy loading for Card components ([6682219](https://github.com/jordanlambrecht/tracker-tracker/commit/66822190af290d9d2e5191947dc1c2024be60cca))


### Refactoring

- add formatRatioDisplay, formatCount, formatPercent, formatDateTime, hexToInt ([aa47790](https://github.com/jordanlambrecht/tracker-tracker/commit/aa4779079141afb49022068456f18faa14fcc1bf))
- add useMemo for crossSeedTags ([8355e72](https://github.com/jordanlambrecht/tracker-tracker/commit/8355e72389c6205d851f9a9316539ecdb4c5f06a))
- better error handling in settings comps ([fed8fe8](https://github.com/jordanlambrecht/tracker-tracker/commit/fed8fe8d76ae9412ec33fb0d000606b45b96f965))
- better notification/torrent handling, add type guards, and improve security checks ([80eb425](https://github.com/jordanlambrecht/tracker-tracker/commit/80eb4259828f19782a4183ca4886f40a8778aa33))
- buttons! ([d26656a](https://github.com/jordanlambrecht/tracker-tracker/commit/d26656a50f1740d5800d2bc3bac1ce75d9759d20))
- collapsed card headers into card component ([1858308](https://github.com/jordanlambrecht/tracker-tracker/commit/1858308a669407504ac84686a8f1b9666eaac09f))
- eliminate fleetTorrentsResponse, export discordEmbed, add parseThresholds ([5d5a5cc](https://github.com/jordanlambrecht/tracker-tracker/commit/5d5a5ccf800e58e99bf92ec55b3ec1eeba547c67))
- enhance backup history retrieval ([deb6360](https://github.com/jordanlambrecht/tracker-tracker/commit/deb6360f3d874031884911a638476415e11e6eb3))
- extract DayRange, DeltaDisplay, API response types ([a6df957](https://github.com/jordanlambrecht/tracker-tracker/commit/a6df9578addb7c28458098e3fd554cec8d820fbf))
- extract more props ([bea7e2e](https://github.com/jordanlambrecht/tracker-tracker/commit/bea7e2e37a10d0b5da6354f7f1fa6aba02950f1b))
- helpers, validators, and formatters oh my ([6e750d2](https://github.com/jordanlambrecht/tracker-tracker/commit/6e750d2494ad7e27b9680f4d53832d6dc1017c60))
- helpers, validators, and formatters oh my pt 2 ([de90cd4](https://github.com/jordanlambrecht/tracker-tracker/commit/de90cd43a12af780b7908b2c929222f94d3a2b7e))
- helpers, validators, and formatters oh my pt 3 ([41f03d8](https://github.com/jordanlambrecht/tracker-tracker/commit/41f03d85e66c62b1d60558f06ac4c58b21e1de88))
- helpers, validators, and formatters oh my pt 4 ([5fef730](https://github.com/jordanlambrecht/tracker-tracker/commit/5fef7308988f0f67b5f3f544165857085879bb55))
- improve mount logic ([08c2f6e](https://github.com/jordanlambrecht/tracker-tracker/commit/08c2f6ec66f1d67758c89f6cfc0983ad7320ffe9))
- lots of hook extractions ([d9a7834](https://github.com/jordanlambrecht/tracker-tracker/commit/d9a7834bd47e5e3aba9d85ddec722aa75e3a1159))
- make routeContext type ([c2979fd](https://github.com/jordanlambrecht/tracker-tracker/commit/c2979fd004561d6af353d19c66c6452c7ae91fe4))
- migrate interactive surfaces to nm-interactive classes ([ef3979a](https://github.com/jordanlambrecht/tracker-tracker/commit/ef3979a7d9dcd2419521a4780cf70c65088b3b42))
- named Drizzle type aliases ([684f758](https://github.com/jordanlambrecht/tracker-tracker/commit/684f7582aede03333df74ddba9d883dea060b310))
- new DataCell component ([0171372](https://github.com/jordanlambrecht/tracker-tracker/commit/017137250386f7976340ece8667b92304cef74cf))
- new SlotLabel component ([fb20902](https://github.com/jordanlambrecht/tracker-tracker/commit/fb20902e292594f2f6afe8f18b41f1a8090e8c8e))
- notificationTarget and downloadClient ([6400e33](https://github.com/jordanlambrecht/tracker-tracker/commit/6400e33a903b1575d4c0aa365d3372699987aba6))
- optimize polling logic ([cb75800](https://github.com/jordanlambrecht/tracker-tracker/commit/cb75800def97802edcd3d1537e1bb308fbfebfbe))
- qbt delta sync migration (wow) ([5150fbf](https://github.com/jordanlambrecht/tracker-tracker/commit/5150fbf9381d7bcfabd781d5819f3e562063f1ba))
- replace hex color regex with isValidHex ([90003b8](https://github.com/jordanlambrecht/tracker-tracker/commit/90003b83ed19d3c59291ecf8e904c5a3bed85d59))
- replace inline formatting with centralized formatters ([813aaeb](https://github.com/jordanlambrecht/tracker-tracker/commit/813aaebffac1991c101ffa3843a1e7327ebf6d26))
- replace manual data fetching with react-query ([a07d62c](https://github.com/jordanlambrecht/tracker-tracker/commit/a07d62c9231285186dfb307d750b56da6847f331))
- silence logging for non-critical errors ([ce33279](https://github.com/jordanlambrecht/tracker-tracker/commit/ce332794b79b95605db8db2cfe9b87ec1968e9ed))
- slimmed down sidebar ([92151f0](https://github.com/jordanlambrecht/tracker-tracker/commit/92151f06adc55775909ebda61efd33950ed4e6c4))
- swap buttons with saveDiscardBar in settings ([fcfb33c](https://github.com/jordanlambrecht/tracker-tracker/commit/fcfb33c715dc244bc811a00f95692438bf8ab0fb))
- switched a lot of stuff to clsx and cva ([462ea57](https://github.com/jordanlambrecht/tracker-tracker/commit/462ea57daf79f2d51efb44c1543dc3de591fdee7))
- switched to node-html-parser ([e8b7728](https://github.com/jordanlambrecht/tracker-tracker/commit/e8b77286aea80be21654dbe79652e0892fbc5236))
- type alert pruning ([0c1cbf3](https://github.com/jordanlambrecht/tracker-tracker/commit/0c1cbf306fd9419f52606ff8083016f2ed454174))
- type parsePlatformMeta return as PlatformMeta union, fix bigint optional chaining ([6bdf5dd](https://github.com/jordanlambrecht/tracker-tracker/commit/6bdf5ddd2253785c3b16e35430472ba04d0cea1e))
- **typography:** replace inline label spans with H2 component ([8003d72](https://github.com/jordanlambrecht/tracker-tracker/commit/8003d72b4cc3752f591756b78972b3723760190a))
- unified text sizes ([1b6080e](https://github.com/jordanlambrecht/tracker-tracker/commit/1b6080e4c74273e426d88ca9174ec366ec2d079e))
- update action status terminology from "testing" to "pending" ([42f8f81](https://github.com/jordanlambrecht/tracker-tracker/commit/42f8f8198bb38c13298291f6492fd960017804fd))
- update chart color constants to use theme colors ([1951931](https://github.com/jordanlambrecht/tracker-tracker/commit/19519311ced3491855ed584043d161f0dd368ad0))
- update notification circuit breaker state handling ([c36a0bd](https://github.com/jordanlambrecht/tracker-tracker/commit/c36a0bd1bcca5f009f6ec38e7aff475655f18fd6))

## [2.7.1](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.6.0...v2.7.1) (2026-03-31)


### Features

- add AvistaZ slots for activity and badges ([f4ba2e4](https://github.com/jordanlambrecht/tracker-tracker/commit/f4ba2e4dc530d75a7c14c87e202568a4905bdd34))
- add ConfirmRemove and SaveDiscardBar components ([01b3ee5](https://github.com/jordanlambrecht/tracker-tracker/commit/01b3ee5374f356822a4e6b14970f01666e865e85))
- add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext ([8f94cac](https://github.com/jordanlambrecht/tracker-tracker/commit/8f94caca9ef4dddb666bf27787725d099ef8cd1a))
- add hint support to Input component and update BackupsSection to use it ([91af8f0](https://github.com/jordanlambrecht/tracker-tracker/commit/91af8f00a2fbc1e020f92b054e945ee49fc822aa))
- add lazy loading support to Card component ([8e6be1f](https://github.com/jordanlambrecht/tracker-tracker/commit/8e6be1f9f6a65278be7ec78ddce1590553966de9))
- add searchParams handling and initialTab prop to TrackerDetailPage ([b32cb9c](https://github.com/jordanlambrecht/tracker-tracker/commit/b32cb9c0ae502ead5f4613ae59480c6e75a979aa))
- add support for luminarr and darkPeers (closes [#113](https://github.com/jordanlambrecht/tracker-tracker/issues/113) and [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114)) ([fe2bea2](https://github.com/jordanlambrecht/tracker-tracker/commit/fe2bea23597b862de4b3f979e7b48bf89f780a6a))
- added confirmAction ui comp ([0b0de15](https://github.com/jordanlambrecht/tracker-tracker/commit/0b0de158b56f705ec05babb1b2f9ac42d97a8752))
- added support for the avistaz network (closes [#112](https://github.com/jordanlambrecht/tracker-tracker/issues/112)) ([ad3ad57](https://github.com/jordanlambrecht/tracker-tracker/commit/ad3ad57a14e1d302c468350f2a254a192b893ae2))
- beefed up Dialog component ([b329e26](https://github.com/jordanlambrecht/tracker-tracker/commit/b329e264a9f83f8f92441a22ac337bb295f5c289))
- extend change-password API to handle notification target re-encryption ([588a0ad](https://github.com/jordanlambrecht/tracker-tracker/commit/588a0ad2b3d2078427f0692c73053cee9b637481))
- implement SectionToggle and ProgressWidget components ([640e517](https://github.com/jordanlambrecht/tracker-tracker/commit/640e517652a6bb151374f30e24a026f42e1ab5e9))
- implement useActionStatus hook for managing action states ([710b7b1](https://github.com/jordanlambrecht/tracker-tracker/commit/710b7b1ac83237bfc8bcfabf711b649ddc17cc1e))
- new formatSpeed formatter ([4ec91a2](https://github.com/jordanlambrecht/tracker-tracker/commit/4ec91a2e65628b660985d4f0fa005fe84a2b85b4))
- new heatmap in torrent fleet on dashboard! ([829973d](https://github.com/jordanlambrecht/tracker-tracker/commit/829973d159289a93f4392385b14b5b69f5d077eb))
- new info tip icon system thing ([d865622](https://github.com/jordanlambrecht/tracker-tracker/commit/d865622c977e57a7952805f4701e29d6b109d182))
- new notice component ([d9c700d](https://github.com/jordanlambrecht/tracker-tracker/commit/d9c700d772e5dcdd507bf6102079ef4f48fedbeb))
- new skeleton loaders ([f9a7054](https://github.com/jordanlambrecht/tracker-tracker/commit/f9a7054a9bd3f140efab3b9ca326e19f9e5561ee))
- new useAnimatedPresence and useEscapeKey hooks ([02fc0f8](https://github.com/jordanlambrecht/tracker-tracker/commit/02fc0f87217a8e9b7622d163bb014744191bd6b5))
- parseIntClamped ([42b4c25](https://github.com/jordanlambrecht/tracker-tracker/commit/42b4c254ce8d67379e4a30f0220b1176f5ee4cdd))
- refactor dirty detection to buildPatch function ([b7e49f3](https://github.com/jordanlambrecht/tracker-tracker/commit/b7e49f3d1e36424a443292b43893cdbec9b460dd))
- removed gravatar fluff ([cb87cda](https://github.com/jordanlambrecht/tracker-tracker/commit/cb87cda8cc0340dece54802101c3270aa0fab7ac))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([e593117](https://github.com/jordanlambrecht/tracker-tracker/commit/e593117f9d0021b94a7d06fcd3f8dd8a5eb42cde))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([cd5f957](https://github.com/jordanlambrecht/tracker-tracker/commit/cd5f957efa3ffca57aa25698c3bc84b529b1e478))
- useCrudCard hook ([5a89c58](https://github.com/jordanlambrecht/tracker-tracker/commit/5a89c58cb9837da6b9ff140ebec72551cb9d339e))


### Bug Fixes

-  avistaZ platform-based trackers not fetching user avatars ([e7fe1df](https://github.com/jordanlambrecht/tracker-tracker/commit/e7fe1df4fa376b9041558fabb6c60022c591fcad))
- add notice for TOTP disabled during backup restore ([a603b35](https://github.com/jordanlambrecht/tracker-tracker/commit/a603b35aae1293dd75afcce19f01150fc8b36a90))
- add tabIndex to InfoTip ([fe4b46a](https://github.com/jordanlambrecht/tracker-tracker/commit/fe4b46a272ebb761f3bed2ce6a777735272d8aa7))
- bad styling ([748b851](https://github.com/jordanlambrecht/tracker-tracker/commit/748b851c5b0fff1f6e77586d1d22cac4d11ad0b3))
- better error handling for setup response messages ([bf7645a](https://github.com/jordanlambrecht/tracker-tracker/commit/bf7645a908322f4800416253e39a73ac594baf52))
- boundaryGap bug on charts ([8b1edc7](https://github.com/jordanlambrecht/tracker-tracker/commit/8b1edc7ce744d4cf61d89469fc3c9be5b29ed4d7))
- chart content not hiding on card collapse (closes [#34](https://github.com/jordanlambrecht/tracker-tracker/issues/34)) ([d29e391](https://github.com/jordanlambrecht/tracker-tracker/commit/d29e391be05ce063220b435e89d2474db2080772))
- don't show editable user joined date for avistaz platform ([e0884d7](https://github.com/jordanlambrecht/tracker-tracker/commit/e0884d723de87e3263954f86a5c4eb655e3efb47))
- duplicate TrackerSummary export ([0d79466](https://github.com/jordanlambrecht/tracker-tracker/commit/0d794667908fa5d47f0079dc995fd85f3cbacd22))
- enforce character limits on proxy username, password, and mousehole URL ([8debdd2](https://github.com/jordanlambrecht/tracker-tracker/commit/8debdd28164ca854a150722133d9830630e009ef))
- ensure default value reference is used in useLocalStorage hook ([4cf6dba](https://github.com/jordanlambrecht/tracker-tracker/commit/4cf6dba6ae776fdcf7eaa8acb9b78694590c7bf2))
- ensure loading state is reset after API calls in AddTrackerDialog ([a971c64](https://github.com/jordanlambrecht/tracker-tracker/commit/a971c64f67d279f82a5c2645c87f03133474f554))
- improve error handling in backup password operations ([11c303a](https://github.com/jordanlambrecht/tracker-tracker/commit/11c303a539b24c552b40ffe909e74b71f6e27804))
- json parsing error ([d140679](https://github.com/jordanlambrecht/tracker-tracker/commit/d14067920d129847181d498f3044d0cbc1cc0c90))
- make footer logo load eagerly ([fd9b6fa](https://github.com/jordanlambrecht/tracker-tracker/commit/fd9b6fa3ac2e55bf24338888352c559bee7fd144))
- make nextjs happy with image components ([826c566](https://github.com/jordanlambrecht/tracker-tracker/commit/826c56696f0116691f2e068f5a701ebc95f3be78))
- make validateHttpUrl function use dynamic error labels ([49482ba](https://github.com/jordanlambrecht/tracker-tracker/commit/49482ba2a90193a7f5f8bbe7bf7448e5d6dea0a8))
- minor placeholder bug ([9f8606b](https://github.com/jordanlambrecht/tracker-tracker/commit/9f8606b62cd05727ede0088132e2315fc101c5b5))
- minor stuff ([ca6496d](https://github.com/jordanlambrecht/tracker-tracker/commit/ca6496d7f12859148f62254ba8d1e8112e530387))
- oops ([fe9e801](https://github.com/jordanlambrecht/tracker-tracker/commit/fe9e801c5261d9e183a215b1a4072b544bd14e24))
- oops 2 ([f5a0d1a](https://github.com/jordanlambrecht/tracker-tracker/commit/f5a0d1aa9dcfe4a59bd2e9a098b0768ef42b1a4d))
- optimize database queries ([56ee982](https://github.com/jordanlambrecht/tracker-tracker/commit/56ee9829925c6edf0332afa1bda3e0dbed3b2481))
- optimize deletion of old checkpoints ([32a177d](https://github.com/jordanlambrecht/tracker-tracker/commit/32a177d75d4f652d3e7737dafe3324b122e0b6c9))
- persist showTodayAtAGlance setting, serialize dates ([f95f56c](https://github.com/jordanlambrecht/tracker-tracker/commit/f95f56c9c83fd5da10e779ad337f3ddf4715ebd0))
- remove unused import ([b454085](https://github.com/jordanlambrecht/tracker-tracker/commit/b454085a386dec9df8dc0d95427f0f650bf4d726))
- removed unnecessary lazy loading from Elder Torrents section ([35e3caa](https://github.com/jordanlambrecht/tracker-tracker/commit/35e3caa1e692eb4b498409b622069e62951a789e))
- replace useEffect with useLayoutEffect ([4dd01ad](https://github.com/jordanlambrecht/tracker-tracker/commit/4dd01ad8cb02ca3e713432dc3658a75a68053811))
- simplify shouldMount logic in ChartCard component ([673ed48](https://github.com/jordanlambrecht/tracker-tracker/commit/673ed483b38afb83968f58375fe65e04ad93c941))
- unify error handling in SetupForm ([7aec2ee](https://github.com/jordanlambrecht/tracker-tracker/commit/7aec2ee742e73dc9682cdf7c90e7a772fea3fda8))
- use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants ([f847941](https://github.com/jordanlambrecht/tracker-tracker/commit/f847941b7effd2d0f4b8abeab185f3ae703262d9))
- wrong Content-Type for cached avatar images ([ca9e1fa](https://github.com/jordanlambrecht/tracker-tracker/commit/ca9e1fa3a5217c6aeb1c6a95098436306a8879fb))
- x-axis was showing wrong values, zoom bug ([b6eea34](https://github.com/jordanlambrecht/tracker-tracker/commit/b6eea3499dcd050162ceca0e6ba2a94fc0a2b15e))


### Performance

- bg blur on dialog open was sexy but caused too much lag ([2780d5e](https://github.com/jordanlambrecht/tracker-tracker/commit/2780d5e03a568a5e16f1b176b61bd50ee92c6690))
- clear timer on unmount ([95024aa](https://github.com/jordanlambrecht/tracker-tracker/commit/95024aa1f2bdd9bbe00cdcc49845e4ff19fa1aa3))
- dynamically import ChangelogContent ([ae47380](https://github.com/jordanlambrecht/tracker-tracker/commit/ae473804ddc9ad9826b37bd1bf0d8a976d9dd5c7))
- dynamically import DashboardSettingsSheet ([add5c23](https://github.com/jordanlambrecht/tracker-tracker/commit/add5c2332f930f76e1fb45617333e366337bbd94))
- dynamically import EmojiPicker ([d4132cf](https://github.com/jordanlambrecht/tracker-tracker/commit/d4132cf13dbf518d20f2effdabc89e30adf941c3))
- dynamically import QRCodeSVG ([6f31fdb](https://github.com/jordanlambrecht/tracker-tracker/commit/6f31fdba7b259d832de91020d8208e74a3024290))
- dynamically import TorrentAgeScatter3D ([d233542](https://github.com/jordanlambrecht/tracker-tracker/commit/d233542a1e0d5f28138c61ab6226cf575f65afc2))
- improved query stability ([955cce3](https://github.com/jordanlambrecht/tracker-tracker/commit/955cce348964d4ad269e54da878df6c7af422fa4))
- optimize sortOrder update logic ([b2cea74](https://github.com/jordanlambrecht/tracker-tracker/commit/b2cea7496e25a741806e91a24ea54d25545602f3))
- prevent unnecessary re-renders ([7616408](https://github.com/jordanlambrecht/tracker-tracker/commit/7616408726d97cedc4075195c65bfc077a10b0d7))
- streamline Mousehole URL validation in PATCH and POST functions ([011f725](https://github.com/jordanlambrecht/tracker-tracker/commit/011f725169c5828e7c4cf25d3b8487647f1982da))
- torrentsTab component to use lazy loading for Card components ([6682219](https://github.com/jordanlambrecht/tracker-tracker/commit/66822190af290d9d2e5191947dc1c2024be60cca))


### Refactoring

- add formatRatioDisplay, formatCount, formatPercent, formatDateTime, hexToInt ([aa47790](https://github.com/jordanlambrecht/tracker-tracker/commit/aa4779079141afb49022068456f18faa14fcc1bf))
- add useMemo for crossSeedTags ([8355e72](https://github.com/jordanlambrecht/tracker-tracker/commit/8355e72389c6205d851f9a9316539ecdb4c5f06a))
- better error handling in settings comps ([fed8fe8](https://github.com/jordanlambrecht/tracker-tracker/commit/fed8fe8d76ae9412ec33fb0d000606b45b96f965))
- better notification/torrent handling, add type guards, and improve security checks ([80eb425](https://github.com/jordanlambrecht/tracker-tracker/commit/80eb4259828f19782a4183ca4886f40a8778aa33))
- buttons! ([d26656a](https://github.com/jordanlambrecht/tracker-tracker/commit/d26656a50f1740d5800d2bc3bac1ce75d9759d20))
- collapsed card headers into card component ([1858308](https://github.com/jordanlambrecht/tracker-tracker/commit/1858308a669407504ac84686a8f1b9666eaac09f))
- eliminate fleetTorrentsResponse, export discordEmbed, add parseThresholds ([5d5a5cc](https://github.com/jordanlambrecht/tracker-tracker/commit/5d5a5ccf800e58e99bf92ec55b3ec1eeba547c67))
- enhance backup history retrieval ([deb6360](https://github.com/jordanlambrecht/tracker-tracker/commit/deb6360f3d874031884911a638476415e11e6eb3))
- extract DayRange, DeltaDisplay, API response types ([a6df957](https://github.com/jordanlambrecht/tracker-tracker/commit/a6df9578addb7c28458098e3fd554cec8d820fbf))
- extract more props ([bea7e2e](https://github.com/jordanlambrecht/tracker-tracker/commit/bea7e2e37a10d0b5da6354f7f1fa6aba02950f1b))
- helpers, validators, and formatters oh my ([6e750d2](https://github.com/jordanlambrecht/tracker-tracker/commit/6e750d2494ad7e27b9680f4d53832d6dc1017c60))
- helpers, validators, and formatters oh my pt 2 ([de90cd4](https://github.com/jordanlambrecht/tracker-tracker/commit/de90cd43a12af780b7908b2c929222f94d3a2b7e))
- helpers, validators, and formatters oh my pt 3 ([41f03d8](https://github.com/jordanlambrecht/tracker-tracker/commit/41f03d85e66c62b1d60558f06ac4c58b21e1de88))
- helpers, validators, and formatters oh my pt 4 ([5fef730](https://github.com/jordanlambrecht/tracker-tracker/commit/5fef7308988f0f67b5f3f544165857085879bb55))
- improve mount logic ([08c2f6e](https://github.com/jordanlambrecht/tracker-tracker/commit/08c2f6ec66f1d67758c89f6cfc0983ad7320ffe9))
- lots of hook extractions ([d9a7834](https://github.com/jordanlambrecht/tracker-tracker/commit/d9a7834bd47e5e3aba9d85ddec722aa75e3a1159))
- make routeContext type ([c2979fd](https://github.com/jordanlambrecht/tracker-tracker/commit/c2979fd004561d6af353d19c66c6452c7ae91fe4))
- migrate interactive surfaces to nm-interactive classes ([ef3979a](https://github.com/jordanlambrecht/tracker-tracker/commit/ef3979a7d9dcd2419521a4780cf70c65088b3b42))
- named Drizzle type aliases ([684f758](https://github.com/jordanlambrecht/tracker-tracker/commit/684f7582aede03333df74ddba9d883dea060b310))
- new DataCell component ([0171372](https://github.com/jordanlambrecht/tracker-tracker/commit/017137250386f7976340ece8667b92304cef74cf))
- new SlotLabel component ([fb20902](https://github.com/jordanlambrecht/tracker-tracker/commit/fb20902e292594f2f6afe8f18b41f1a8090e8c8e))
- notificationTarget and downloadClient ([6400e33](https://github.com/jordanlambrecht/tracker-tracker/commit/6400e33a903b1575d4c0aa365d3372699987aba6))
- optimize polling logic ([cb75800](https://github.com/jordanlambrecht/tracker-tracker/commit/cb75800def97802edcd3d1537e1bb308fbfebfbe))
- qbt delta sync migration (wow) ([5150fbf](https://github.com/jordanlambrecht/tracker-tracker/commit/5150fbf9381d7bcfabd781d5819f3e562063f1ba))
- replace hex color regex with isValidHex ([90003b8](https://github.com/jordanlambrecht/tracker-tracker/commit/90003b83ed19d3c59291ecf8e904c5a3bed85d59))
- replace inline formatting with centralized formatters ([813aaeb](https://github.com/jordanlambrecht/tracker-tracker/commit/813aaebffac1991c101ffa3843a1e7327ebf6d26))
- replace manual data fetching with react-query ([a07d62c](https://github.com/jordanlambrecht/tracker-tracker/commit/a07d62c9231285186dfb307d750b56da6847f331))
- silence logging for non-critical errors ([ce33279](https://github.com/jordanlambrecht/tracker-tracker/commit/ce332794b79b95605db8db2cfe9b87ec1968e9ed))
- slimmed down sidebar ([92151f0](https://github.com/jordanlambrecht/tracker-tracker/commit/92151f06adc55775909ebda61efd33950ed4e6c4))
- swap buttons with saveDiscardBar in settings ([fcfb33c](https://github.com/jordanlambrecht/tracker-tracker/commit/fcfb33c715dc244bc811a00f95692438bf8ab0fb))
- switched a lot of stuff to clsx and cva ([462ea57](https://github.com/jordanlambrecht/tracker-tracker/commit/462ea57daf79f2d51efb44c1543dc3de591fdee7))
- switched to node-html-parser ([e8b7728](https://github.com/jordanlambrecht/tracker-tracker/commit/e8b77286aea80be21654dbe79652e0892fbc5236))
- type alert pruning ([0c1cbf3](https://github.com/jordanlambrecht/tracker-tracker/commit/0c1cbf306fd9419f52606ff8083016f2ed454174))
- type parsePlatformMeta return as PlatformMeta union, fix bigint optional chaining ([6bdf5dd](https://github.com/jordanlambrecht/tracker-tracker/commit/6bdf5ddd2253785c3b16e35430472ba04d0cea1e))
- **typography:** replace inline label spans with H2 component ([8003d72](https://github.com/jordanlambrecht/tracker-tracker/commit/8003d72b4cc3752f591756b78972b3723760190a))
- unified text sizes ([1b6080e](https://github.com/jordanlambrecht/tracker-tracker/commit/1b6080e4c74273e426d88ca9174ec366ec2d079e))
- update action status terminology from "testing" to "pending" ([42f8f81](https://github.com/jordanlambrecht/tracker-tracker/commit/42f8f8198bb38c13298291f6492fd960017804fd))
- update chart color constants to use theme colors ([1951931](https://github.com/jordanlambrecht/tracker-tracker/commit/19519311ced3491855ed584043d161f0dd368ad0))
- update notification circuit breaker state handling ([c36a0bd](https://github.com/jordanlambrecht/tracker-tracker/commit/c36a0bd1bcca5f009f6ec38e7aff475655f18fd6))

## [2.7.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.6.0...v2.7.0) (2026-03-31)


### Features

- add AvistaZ slots for activity and badges ([f4ba2e4](https://github.com/jordanlambrecht/tracker-tracker/commit/f4ba2e4dc530d75a7c14c87e202568a4905bdd34))
- add ConfirmRemove and SaveDiscardBar components ([01b3ee5](https://github.com/jordanlambrecht/tracker-tracker/commit/01b3ee5374f356822a4e6b14970f01666e865e85))
- add download_disabled + vip_expiring for AvistaZ plat, rename mamContext to platformContext ([8f94cac](https://github.com/jordanlambrecht/tracker-tracker/commit/8f94caca9ef4dddb666bf27787725d099ef8cd1a))
- add hint support to Input component and update BackupsSection to use it ([91af8f0](https://github.com/jordanlambrecht/tracker-tracker/commit/91af8f00a2fbc1e020f92b054e945ee49fc822aa))
- add lazy loading support to Card component ([8e6be1f](https://github.com/jordanlambrecht/tracker-tracker/commit/8e6be1f9f6a65278be7ec78ddce1590553966de9))
- add searchParams handling and initialTab prop to TrackerDetailPage ([b32cb9c](https://github.com/jordanlambrecht/tracker-tracker/commit/b32cb9c0ae502ead5f4613ae59480c6e75a979aa))
- add support for luminarr and darkPeers (closes [#113](https://github.com/jordanlambrecht/tracker-tracker/issues/113) and [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114)) ([fe2bea2](https://github.com/jordanlambrecht/tracker-tracker/commit/fe2bea23597b862de4b3f979e7b48bf89f780a6a))
- added confirmAction ui comp ([0b0de15](https://github.com/jordanlambrecht/tracker-tracker/commit/0b0de158b56f705ec05babb1b2f9ac42d97a8752))
- added support for the avistaz network (closes [#112](https://github.com/jordanlambrecht/tracker-tracker/issues/112)) ([ad3ad57](https://github.com/jordanlambrecht/tracker-tracker/commit/ad3ad57a14e1d302c468350f2a254a192b893ae2))
- beefed up Dialog component ([b329e26](https://github.com/jordanlambrecht/tracker-tracker/commit/b329e264a9f83f8f92441a22ac337bb295f5c289))
- extend change-password API to handle notification target re-encryption ([588a0ad](https://github.com/jordanlambrecht/tracker-tracker/commit/588a0ad2b3d2078427f0692c73053cee9b637481))
- implement SectionToggle and ProgressWidget components ([640e517](https://github.com/jordanlambrecht/tracker-tracker/commit/640e517652a6bb151374f30e24a026f42e1ab5e9))
- implement useActionStatus hook for managing action states ([710b7b1](https://github.com/jordanlambrecht/tracker-tracker/commit/710b7b1ac83237bfc8bcfabf711b649ddc17cc1e))
- new formatSpeed formatter ([4ec91a2](https://github.com/jordanlambrecht/tracker-tracker/commit/4ec91a2e65628b660985d4f0fa005fe84a2b85b4))
- new heatmap in torrent fleet on dashboard! ([829973d](https://github.com/jordanlambrecht/tracker-tracker/commit/829973d159289a93f4392385b14b5b69f5d077eb))
- new info tip icon system thing ([d865622](https://github.com/jordanlambrecht/tracker-tracker/commit/d865622c977e57a7952805f4701e29d6b109d182))
- new notice component ([d9c700d](https://github.com/jordanlambrecht/tracker-tracker/commit/d9c700d772e5dcdd507bf6102079ef4f48fedbeb))
- new skeleton loaders ([f9a7054](https://github.com/jordanlambrecht/tracker-tracker/commit/f9a7054a9bd3f140efab3b9ca326e19f9e5561ee))
- new useAnimatedPresence and useEscapeKey hooks ([02fc0f8](https://github.com/jordanlambrecht/tracker-tracker/commit/02fc0f87217a8e9b7622d163bb014744191bd6b5))
- parseIntClamped ([42b4c25](https://github.com/jordanlambrecht/tracker-tracker/commit/42b4c254ce8d67379e4a30f0220b1176f5ee4cdd))
- refactor dirty detection to buildPatch function ([b7e49f3](https://github.com/jordanlambrecht/tracker-tracker/commit/b7e49f3d1e36424a443292b43893cdbec9b460dd))
- removed gravatar fluff ([cb87cda](https://github.com/jordanlambrecht/tracker-tracker/commit/cb87cda8cc0340dece54802101c3270aa0fab7ac))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([e593117](https://github.com/jordanlambrecht/tracker-tracker/commit/e593117f9d0021b94a7d06fcd3f8dd8a5eb42cde))
- **trackers:** added support for DarkPeers (closes [#114](https://github.com/jordanlambrecht/tracker-tracker/issues/114), thanks @DGeyzer) ([cd5f957](https://github.com/jordanlambrecht/tracker-tracker/commit/cd5f957efa3ffca57aa25698c3bc84b529b1e478))
- useCrudCard hook ([5a89c58](https://github.com/jordanlambrecht/tracker-tracker/commit/5a89c58cb9837da6b9ff140ebec72551cb9d339e))


### Bug Fixes

-  avistaZ platform-based trackers not fetching user avatars ([e7fe1df](https://github.com/jordanlambrecht/tracker-tracker/commit/e7fe1df4fa376b9041558fabb6c60022c591fcad))
- add notice for TOTP disabled during backup restore ([a603b35](https://github.com/jordanlambrecht/tracker-tracker/commit/a603b35aae1293dd75afcce19f01150fc8b36a90))
- add tabIndex to InfoTip ([fe4b46a](https://github.com/jordanlambrecht/tracker-tracker/commit/fe4b46a272ebb761f3bed2ce6a777735272d8aa7))
- bad styling ([748b851](https://github.com/jordanlambrecht/tracker-tracker/commit/748b851c5b0fff1f6e77586d1d22cac4d11ad0b3))
- better error handling for setup response messages ([bf7645a](https://github.com/jordanlambrecht/tracker-tracker/commit/bf7645a908322f4800416253e39a73ac594baf52))
- boundaryGap bug on charts ([8b1edc7](https://github.com/jordanlambrecht/tracker-tracker/commit/8b1edc7ce744d4cf61d89469fc3c9be5b29ed4d7))
- chart content not hiding on card collapse (closes [#34](https://github.com/jordanlambrecht/tracker-tracker/issues/34)) ([d29e391](https://github.com/jordanlambrecht/tracker-tracker/commit/d29e391be05ce063220b435e89d2474db2080772))
- don't show editable user joined date for avistaz platform ([e0884d7](https://github.com/jordanlambrecht/tracker-tracker/commit/e0884d723de87e3263954f86a5c4eb655e3efb47))
- duplicate TrackerSummary export ([0d79466](https://github.com/jordanlambrecht/tracker-tracker/commit/0d794667908fa5d47f0079dc995fd85f3cbacd22))
- enforce character limits on proxy username, password, and mousehole URL ([8debdd2](https://github.com/jordanlambrecht/tracker-tracker/commit/8debdd28164ca854a150722133d9830630e009ef))
- ensure default value reference is used in useLocalStorage hook ([4cf6dba](https://github.com/jordanlambrecht/tracker-tracker/commit/4cf6dba6ae776fdcf7eaa8acb9b78694590c7bf2))
- ensure loading state is reset after API calls in AddTrackerDialog ([a971c64](https://github.com/jordanlambrecht/tracker-tracker/commit/a971c64f67d279f82a5c2645c87f03133474f554))
- improve error handling in backup password operations ([11c303a](https://github.com/jordanlambrecht/tracker-tracker/commit/11c303a539b24c552b40ffe909e74b71f6e27804))
- json parsing error ([d140679](https://github.com/jordanlambrecht/tracker-tracker/commit/d14067920d129847181d498f3044d0cbc1cc0c90))
- make footer logo load eagerly ([fd9b6fa](https://github.com/jordanlambrecht/tracker-tracker/commit/fd9b6fa3ac2e55bf24338888352c559bee7fd144))
- make nextjs happy with image components ([826c566](https://github.com/jordanlambrecht/tracker-tracker/commit/826c56696f0116691f2e068f5a701ebc95f3be78))
- make validateHttpUrl function use dynamic error labels ([49482ba](https://github.com/jordanlambrecht/tracker-tracker/commit/49482ba2a90193a7f5f8bbe7bf7448e5d6dea0a8))
- minor placeholder bug ([9f8606b](https://github.com/jordanlambrecht/tracker-tracker/commit/9f8606b62cd05727ede0088132e2315fc101c5b5))
- oops ([fe9e801](https://github.com/jordanlambrecht/tracker-tracker/commit/fe9e801c5261d9e183a215b1a4072b544bd14e24))
- oops 2 ([f5a0d1a](https://github.com/jordanlambrecht/tracker-tracker/commit/f5a0d1aa9dcfe4a59bd2e9a098b0768ef42b1a4d))
- optimize database queries ([56ee982](https://github.com/jordanlambrecht/tracker-tracker/commit/56ee9829925c6edf0332afa1bda3e0dbed3b2481))
- optimize deletion of old checkpoints ([32a177d](https://github.com/jordanlambrecht/tracker-tracker/commit/32a177d75d4f652d3e7737dafe3324b122e0b6c9))
- persist showTodayAtAGlance setting, serialize dates ([f95f56c](https://github.com/jordanlambrecht/tracker-tracker/commit/f95f56c9c83fd5da10e779ad337f3ddf4715ebd0))
- remove unused import ([b454085](https://github.com/jordanlambrecht/tracker-tracker/commit/b454085a386dec9df8dc0d95427f0f650bf4d726))
- removed unnecessary lazy loading from Elder Torrents section ([35e3caa](https://github.com/jordanlambrecht/tracker-tracker/commit/35e3caa1e692eb4b498409b622069e62951a789e))
- replace useEffect with useLayoutEffect ([4dd01ad](https://github.com/jordanlambrecht/tracker-tracker/commit/4dd01ad8cb02ca3e713432dc3658a75a68053811))
- simplify shouldMount logic in ChartCard component ([673ed48](https://github.com/jordanlambrecht/tracker-tracker/commit/673ed483b38afb83968f58375fe65e04ad93c941))
- unify error handling in SetupForm ([7aec2ee](https://github.com/jordanlambrecht/tracker-tracker/commit/7aec2ee742e73dc9682cdf7c90e7a772fea3fda8))
- use EMPTY_TRACKERS and EMPTY_TRACKER_TAGS constants ([f847941](https://github.com/jordanlambrecht/tracker-tracker/commit/f847941b7effd2d0f4b8abeab185f3ae703262d9))
- wrong Content-Type for cached avatar images ([ca9e1fa](https://github.com/jordanlambrecht/tracker-tracker/commit/ca9e1fa3a5217c6aeb1c6a95098436306a8879fb))
- x-axis was showing wrong values, zoom bug ([b6eea34](https://github.com/jordanlambrecht/tracker-tracker/commit/b6eea3499dcd050162ceca0e6ba2a94fc0a2b15e))


### Performance

- bg blur on dialog open was sexy but caused too much lag ([2780d5e](https://github.com/jordanlambrecht/tracker-tracker/commit/2780d5e03a568a5e16f1b176b61bd50ee92c6690))
- clear timer on unmount ([95024aa](https://github.com/jordanlambrecht/tracker-tracker/commit/95024aa1f2bdd9bbe00cdcc49845e4ff19fa1aa3))
- dynamically import ChangelogContent ([ae47380](https://github.com/jordanlambrecht/tracker-tracker/commit/ae473804ddc9ad9826b37bd1bf0d8a976d9dd5c7))
- dynamically import DashboardSettingsSheet ([add5c23](https://github.com/jordanlambrecht/tracker-tracker/commit/add5c2332f930f76e1fb45617333e366337bbd94))
- dynamically import EmojiPicker ([d4132cf](https://github.com/jordanlambrecht/tracker-tracker/commit/d4132cf13dbf518d20f2effdabc89e30adf941c3))
- dynamically import QRCodeSVG ([6f31fdb](https://github.com/jordanlambrecht/tracker-tracker/commit/6f31fdba7b259d832de91020d8208e74a3024290))
- dynamically import TorrentAgeScatter3D ([d233542](https://github.com/jordanlambrecht/tracker-tracker/commit/d233542a1e0d5f28138c61ab6226cf575f65afc2))
- improved query stability ([955cce3](https://github.com/jordanlambrecht/tracker-tracker/commit/955cce348964d4ad269e54da878df6c7af422fa4))
- optimize sortOrder update logic ([b2cea74](https://github.com/jordanlambrecht/tracker-tracker/commit/b2cea7496e25a741806e91a24ea54d25545602f3))
- prevent unnecessary re-renders ([7616408](https://github.com/jordanlambrecht/tracker-tracker/commit/7616408726d97cedc4075195c65bfc077a10b0d7))
- streamline Mousehole URL validation in PATCH and POST functions ([011f725](https://github.com/jordanlambrecht/tracker-tracker/commit/011f725169c5828e7c4cf25d3b8487647f1982da))
- torrentsTab component to use lazy loading for Card components ([6682219](https://github.com/jordanlambrecht/tracker-tracker/commit/66822190af290d9d2e5191947dc1c2024be60cca))


### Refactoring

- add formatRatioDisplay, formatCount, formatPercent, formatDateTime, hexToInt ([aa47790](https://github.com/jordanlambrecht/tracker-tracker/commit/aa4779079141afb49022068456f18faa14fcc1bf))
- add useMemo for crossSeedTags ([8355e72](https://github.com/jordanlambrecht/tracker-tracker/commit/8355e72389c6205d851f9a9316539ecdb4c5f06a))
- better error handling in settings comps ([fed8fe8](https://github.com/jordanlambrecht/tracker-tracker/commit/fed8fe8d76ae9412ec33fb0d000606b45b96f965))
- better notification/torrent handling, add type guards, and improve security checks ([80eb425](https://github.com/jordanlambrecht/tracker-tracker/commit/80eb4259828f19782a4183ca4886f40a8778aa33))
- buttons! ([d26656a](https://github.com/jordanlambrecht/tracker-tracker/commit/d26656a50f1740d5800d2bc3bac1ce75d9759d20))
- collapsed card headers into card component ([1858308](https://github.com/jordanlambrecht/tracker-tracker/commit/1858308a669407504ac84686a8f1b9666eaac09f))
- eliminate fleetTorrentsResponse, export discordEmbed, add parseThresholds ([5d5a5cc](https://github.com/jordanlambrecht/tracker-tracker/commit/5d5a5ccf800e58e99bf92ec55b3ec1eeba547c67))
- enhance backup history retrieval ([deb6360](https://github.com/jordanlambrecht/tracker-tracker/commit/deb6360f3d874031884911a638476415e11e6eb3))
- extract DayRange, DeltaDisplay, API response types ([a6df957](https://github.com/jordanlambrecht/tracker-tracker/commit/a6df9578addb7c28458098e3fd554cec8d820fbf))
- extract more props ([bea7e2e](https://github.com/jordanlambrecht/tracker-tracker/commit/bea7e2e37a10d0b5da6354f7f1fa6aba02950f1b))
- helpers, validators, and formatters oh my ([6e750d2](https://github.com/jordanlambrecht/tracker-tracker/commit/6e750d2494ad7e27b9680f4d53832d6dc1017c60))
- helpers, validators, and formatters oh my pt 2 ([de90cd4](https://github.com/jordanlambrecht/tracker-tracker/commit/de90cd43a12af780b7908b2c929222f94d3a2b7e))
- helpers, validators, and formatters oh my pt 3 ([41f03d8](https://github.com/jordanlambrecht/tracker-tracker/commit/41f03d85e66c62b1d60558f06ac4c58b21e1de88))
- helpers, validators, and formatters oh my pt 4 ([5fef730](https://github.com/jordanlambrecht/tracker-tracker/commit/5fef7308988f0f67b5f3f544165857085879bb55))
- improve mount logic ([08c2f6e](https://github.com/jordanlambrecht/tracker-tracker/commit/08c2f6ec66f1d67758c89f6cfc0983ad7320ffe9))
- lots of hook extractions ([d9a7834](https://github.com/jordanlambrecht/tracker-tracker/commit/d9a7834bd47e5e3aba9d85ddec722aa75e3a1159))
- make routeContext type ([c2979fd](https://github.com/jordanlambrecht/tracker-tracker/commit/c2979fd004561d6af353d19c66c6452c7ae91fe4))
- migrate interactive surfaces to nm-interactive classes ([ef3979a](https://github.com/jordanlambrecht/tracker-tracker/commit/ef3979a7d9dcd2419521a4780cf70c65088b3b42))
- named Drizzle type aliases ([684f758](https://github.com/jordanlambrecht/tracker-tracker/commit/684f7582aede03333df74ddba9d883dea060b310))
- new DataCell component ([0171372](https://github.com/jordanlambrecht/tracker-tracker/commit/017137250386f7976340ece8667b92304cef74cf))
- new SlotLabel component ([fb20902](https://github.com/jordanlambrecht/tracker-tracker/commit/fb20902e292594f2f6afe8f18b41f1a8090e8c8e))
- notificationTarget and downloadClient ([6400e33](https://github.com/jordanlambrecht/tracker-tracker/commit/6400e33a903b1575d4c0aa365d3372699987aba6))
- optimize polling logic ([cb75800](https://github.com/jordanlambrecht/tracker-tracker/commit/cb75800def97802edcd3d1537e1bb308fbfebfbe))
- qbt delta sync migration (wow) ([5150fbf](https://github.com/jordanlambrecht/tracker-tracker/commit/5150fbf9381d7bcfabd781d5819f3e562063f1ba))
- replace hex color regex with isValidHex ([90003b8](https://github.com/jordanlambrecht/tracker-tracker/commit/90003b83ed19d3c59291ecf8e904c5a3bed85d59))
- replace inline formatting with centralized formatters ([813aaeb](https://github.com/jordanlambrecht/tracker-tracker/commit/813aaebffac1991c101ffa3843a1e7327ebf6d26))
- replace manual data fetching with react-query ([a07d62c](https://github.com/jordanlambrecht/tracker-tracker/commit/a07d62c9231285186dfb307d750b56da6847f331))
- silence logging for non-critical errors ([ce33279](https://github.com/jordanlambrecht/tracker-tracker/commit/ce332794b79b95605db8db2cfe9b87ec1968e9ed))
- slimmed down sidebar ([92151f0](https://github.com/jordanlambrecht/tracker-tracker/commit/92151f06adc55775909ebda61efd33950ed4e6c4))
- swap buttons with saveDiscardBar in settings ([fcfb33c](https://github.com/jordanlambrecht/tracker-tracker/commit/fcfb33c715dc244bc811a00f95692438bf8ab0fb))
- switched a lot of stuff to clsx and cva ([462ea57](https://github.com/jordanlambrecht/tracker-tracker/commit/462ea57daf79f2d51efb44c1543dc3de591fdee7))
- switched to node-html-parser ([e8b7728](https://github.com/jordanlambrecht/tracker-tracker/commit/e8b77286aea80be21654dbe79652e0892fbc5236))
- type alert pruning ([0c1cbf3](https://github.com/jordanlambrecht/tracker-tracker/commit/0c1cbf306fd9419f52606ff8083016f2ed454174))
- type parsePlatformMeta return as PlatformMeta union, fix bigint optional chaining ([6bdf5dd](https://github.com/jordanlambrecht/tracker-tracker/commit/6bdf5ddd2253785c3b16e35430472ba04d0cea1e))
- **typography:** replace inline label spans with H2 component ([8003d72](https://github.com/jordanlambrecht/tracker-tracker/commit/8003d72b4cc3752f591756b78972b3723760190a))
- unified text sizes ([1b6080e](https://github.com/jordanlambrecht/tracker-tracker/commit/1b6080e4c74273e426d88ca9174ec366ec2d079e))
- update action status terminology from "testing" to "pending" ([42f8f81](https://github.com/jordanlambrecht/tracker-tracker/commit/42f8f8198bb38c13298291f6492fd960017804fd))
- update chart color constants to use theme colors ([1951931](https://github.com/jordanlambrecht/tracker-tracker/commit/19519311ced3491855ed584043d161f0dd368ad0))
- update notification circuit breaker state handling ([c36a0bd](https://github.com/jordanlambrecht/tracker-tracker/commit/c36a0bd1bcca5f009f6ec38e7aff475655f18fd6))

## [2.6.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.4.1...v2.6.0) (2026-03-27)

### Features

- **dashboard:** add Today At A Glance server logic, checkpoints, and deep poll fixes ([d3826a1](https://github.com/jordanlambrecht/tracker-tracker/commit/d3826a181c017c6b2ac8bbc6fa9d77f6dfd0edc2))
- **dashboard:** add Today At A Glance UI ([84c5227](https://github.com/jordanlambrecht/tracker-tracker/commit/84c522750f517c95653b73e1298aa72bd204e27f))
- **mam:** add bonus cap, VIP expiry, unsatisfied limit, and active HnR notifications ([2b210d7](https://github.com/jordanlambrecht/tracker-tracker/commit/2b210d76542db6a7377c13d7e9a9abf51cc48752))
- **mam:** add Mousehole integration ([0e28443](https://github.com/jordanlambrecht/tracker-tracker/commit/0e28443875c1de70b1dea0f3662ae9625000da0f))
- **mam:** add MyAnonaMouse adapter ([692d312](https://github.com/jordanlambrecht/tracker-tracker/commit/692d3124cd648a3f1278b38881df5083f7febdc1))
- **mam:** add platform UI with health overview, badges, and FL Wedges chart ([3bb280e](https://github.com/jordanlambrecht/tracker-tracker/commit/3bb280e302ae4f4afeab667b912f5cea0e6f501c))
- **schema:** add daily checkpoint tables and TodayAtAGlance types ([636d227](https://github.com/jordanlambrecht/tracker-tracker/commit/636d22701cd43d8827f9afe49a5105820578f892))
- **security:** enhance security audit checks and improve vulnerability reporting ([23b4cae](https://github.com/jordanlambrecht/tracker-tracker/commit/23b4cae6420d17a1e1f86e9b925841726e28ccfe))
- **settings:** display database size ([67ff496](https://github.com/jordanlambrecht/tracker-tracker/commit/67ff4961e5d6ba50655ed0a9229ba807a26e1bbe))

### Bug Fixes

- **api:** improve session expiration error message ([5a95cd0](https://github.com/jordanlambrecht/tracker-tracker/commit/5a95cd039daf5aebb128f547acf70ae749132221))
- **auth:** decouple cookie secure flag from node_env for self-hosted http deployments. Closes [#101](https://github.com/jordanlambrecht/tracker-tracker/issues/101) ([b2a7902](https://github.com/jordanlambrecht/tracker-tracker/commit/b2a790245ca76f1ec3ef8220c273a4ab9ca508fd))
- **auth:** return 401 on stale session instead of misleading credential errors ([cf54c7f](https://github.com/jordanlambrecht/tracker-tracker/commit/cf54c7fbd6c2d9171b5d11b621e9a1f68abc381a))
- **backups:** enforce maximum length for backup password to 128 characters ([5e6d58e](https://github.com/jordanlambrecht/tracker-tracker/commit/5e6d58e361fbcfa6323e414b3702768d895d85d7))
- **Dockerfile:** update package.json for drizzle-kit with esbuild overrides ([bce0854](https://github.com/jordanlambrecht/tracker-tracker/commit/bce0854d8ea18cf4a99488ed6d9243b25fc71658))
- ensure backfill flag is set after successful checkpoint backfill ([60f5786](https://github.com/jordanlambrecht/tracker-tracker/commit/60f5786134f346e4ba07684d210f3806bd384468))
- error logging for BigInt conversion failures ([e91b30a](https://github.com/jordanlambrecht/tracker-tracker/commit/e91b30a79605ac73c34c39e372ad2aaca4c09c44))
- error logging for BigInt conversion failures in computeTodayAtAGlance ([15eb043](https://github.com/jordanlambrecht/tracker-tracker/commit/15eb043989fa2611acc846032aae1e049fef7000))
- **errors:** improve error handling and logging for backup and tracker operations ([7f7b202](https://github.com/jordanlambrecht/tracker-tracker/commit/7f7b202e2557d25cd011c8bd96e14332f3565bb1))
- **Icons:** update DownloadArrowIcon stroke width ([d2cd450](https://github.com/jordanlambrecht/tracker-tracker/commit/d2cd450af0b6cf55bc5fc1c94ea01452c55252fb))
- improve error handling for decryption failures in fetchAndMergeTorrents ([0b07d40](https://github.com/jordanlambrecht/tracker-tracker/commit/0b07d40ddaca93f188eeb166e53431764cb1bb8e))
- normalize tracker tags to lowercase ([762988f](https://github.com/jordanlambrecht/tracker-tracker/commit/762988f2228218cf27b2d12c138bb0e2dfa1c5b1))
- optimize torrent checkpoint insertion by batching database writes ([90285d6](https://github.com/jordanlambrecht/tracker-tracker/commit/90285d69b1dd709d0f77682ecb797a20fe3fea1c))
- resolve lint warnings, Copilot review issues, remove dead code, and harden error handling ([815b479](https://github.com/jordanlambrecht/tracker-tracker/commit/815b479047fc956b965556cdcc01d39bc1ce4a33))
- **ui:** prevent StatCard DOM prop leak ([2d0b22a](https://github.com/jordanlambrecht/tracker-tracker/commit/2d0b22aa51b1badeb8916ace9505fdf32f526dc9))
- update drizzle-kit, drizzle-orm, and postgres to specific versions in Dockerfile ([303c6f5](https://github.com/jordanlambrecht/tracker-tracker/commit/303c6f5b21195a9a15a66f227dab4c022eca36b9))
- update VALID_PLATFORMS to use VALID_PLATFORM_TYPES constant ([8cff4ee](https://github.com/jordanlambrecht/tracker-tracker/commit/8cff4ee6fabc274ca644aac65433a03fedbc0d53))
- use localDateStr for cutoff date in pruneOldCheckpoints function ([0b465b6](https://github.com/jordanlambrecht/tracker-tracker/commit/0b465b6c139333ebcb8650fcf8224d5a70076bee))

### Refactoring

- **Dockerfile:** cleaned up build stages ([3b96ff9](https://github.com/jordanlambrecht/tracker-tracker/commit/3b96ff964058f33d3fe8fd65bf7a6fcde9dbcd3b))
- reuse ProgressBar component and extract slot-label utility ([c3d9031](https://github.com/jordanlambrecht/tracker-tracker/commit/c3d90315d4ca8717f983a3d270d922cc0355de18))

## [2.5.0](https://github.com/jordanlambrecht/tracker-tracker/compare/v2.3.0...v2.5.0) (2026-03-26)

### Features

- add development image to docker hub ([8785094](https://github.com/jordanlambrecht/tracker-tracker/commit/87850942f118ccfd23c0a04d537928cd3db82976))
- add fetchTrackerStats for future live transit paper data ([ed6662f](https://github.com/jordanlambrecht/tracker-tracker/commit/ed6662f0ac0c9990b6c96e8ae5616452385b6c26))
- add GitHub Actions workflow for building and pushing development Docker image ([dca0af0](https://github.com/jordanlambrecht/tracker-tracker/commit/dca0af0a75a4ce21fbe14414d86d4ecbe4d459d3))
- add per-tracker pause polling ([14a6c43](https://github.com/jordanlambrecht/tracker-tracker/commit/14a6c43cd6764924aba6e2fa592ef13d208b528a))
- add system events viewer and log management ([b01ed22](https://github.com/jordanlambrecht/tracker-tracker/commit/b01ed22ec2ecfefe7f12bb448998d2726cb6b7f9))
- **dashboard:** add Today At A Glance server logic, checkpoints, and deep poll fixes ([d3826a1](https://github.com/jordanlambrecht/tracker-tracker/commit/d3826a181c017c6b2ac8bbc6fa9d77f6dfd0edc2))
- **dashboard:** add Today At A Glance UI ([84c5227](https://github.com/jordanlambrecht/tracker-tracker/commit/84c522750f517c95653b73e1298aa72bd204e27f))
- remote image upload ([a480c34](https://github.com/jordanlambrecht/tracker-tracker/commit/a480c3470b7e97e44764c1d9c6d1bee356d22728))
- **schema:** add daily checkpoint tables and TodayAtAGlance types ([636d227](https://github.com/jordanlambrecht/tracker-tracker/commit/636d22701cd43d8827f9afe49a5105820578f892))
- **ui:** add pause/resume button ([c89299e](https://github.com/jordanlambrecht/tracker-tracker/commit/c89299ee80b9ce5ab22743039b6abd40be5a27b6))
- **ui:** lazy-load chart sections, prefetch sidebar links, and fix scroll-to-top on navigation ([ba8f59e](https://github.com/jordanlambrecht/tracker-tracker/commit/ba8f59ee33a21be72034f296f5da1ae795e03c70))

### Bug Fixes

- **api:** improve session expiration error message ([5a95cd0](https://github.com/jordanlambrecht/tracker-tracker/commit/5a95cd039daf5aebb128f547acf70ae749132221))
- **api:** orpheus was not matching seeding/leeching to response ([4569238](https://github.com/jordanlambrecht/tracker-tracker/commit/456923879b2970c46432bc9a0b604da2685bc31d))
- **auth:** decouple cookie secure flag from node_env for self-hosted http deployments. Closes [#101](https://github.com/jordanlambrecht/tracker-tracker/issues/101) ([b2a7902](https://github.com/jordanlambrecht/tracker-tracker/commit/b2a790245ca76f1ec3ef8220c273a4ab9ca508fd))
- **auth:** return 401 on stale session instead of misleading credential errors ([cf54c7f](https://github.com/jordanlambrecht/tracker-tracker/commit/cf54c7fbd6c2d9171b5d11b621e9a1f68abc381a))
- better regex for splitting comparison values in timing safe check ([8c67a50](https://github.com/jordanlambrecht/tracker-tracker/commit/8c67a50cb64196831d7b021249eb76e84766e009))
- convert bold numbered rules to markdown list items ([6e96454](https://github.com/jordanlambrecht/tracker-tracker/commit/6e964541330cca791818aca5d703e03ac2165694))
- deploy issues ([cf45ea1](https://github.com/jordanlambrecht/tracker-tracker/commit/cf45ea19726b8f31db5080ebe93909dd0825e995))
- **Dockerfile:** update package.json for drizzle-kit with esbuild overrides ([bce0854](https://github.com/jordanlambrecht/tracker-tracker/commit/bce0854d8ea18cf4a99488ed6d9243b25fc71658))
- **Icons:** update DownloadArrowIcon stroke width ([d2cd450](https://github.com/jordanlambrecht/tracker-tracker/commit/d2cd450af0b6cf55bc5fc1c94ea01452c55252fb))
- preload fleet dashboard tab ([5f08951](https://github.com/jordanlambrecht/tracker-tracker/commit/5f0895192f39a740927594ab6617f2c5c04b5708))
- resolve biome lint warnings ([af8807d](https://github.com/jordanlambrecht/tracker-tracker/commit/af8807d72847e139be396778a096a7695fc49123))
- **trackers:** markdown rendering ([a5fbdde](https://github.com/jordanlambrecht/tracker-tracker/commit/a5fbdde7056848bb58fdbe6f1e77a765a543842d))
- **ui:** prevent StatCard DOM prop leak ([2d0b22a](https://github.com/jordanlambrecht/tracker-tracker/commit/2d0b22aa51b1badeb8916ace9505fdf32f526dc9))
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
