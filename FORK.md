# Fork notes — patrickdundas/tracker-tracker

Fork of [jordanlambrecht/tracker-tracker](https://github.com/jordanlambrecht/tracker-tracker)
(GPL-3.0), maintained for Patrick's homelab. Deployed on the `yams` VM at
`http://192.168.8.199:3838`; see `docs/tracker-stats.md` in the `homelab-agent` repo.

## Why this fork exists

TorrentLeech hit-and-run tracking. TL has no public API, so stats come from scraping the logged-in
profile page — and upstream's TL adapter (via PR #175) stubs `hitAndRuns: null`. HnR visibility
across trackers is the whole reason this dashboard was deployed, so that gap is the fork's purpose.

## Branch strategy

| Branch | Role |
|---|---|
| `main` | **Integration + deploy branch.** `release.yml` triggers on push here and publishes to `ghcr.io/patrickdundas/tracker-tracker`. Upstream is merged *into* this. |
| `feat/*` | Work branches. PR into `main` so `ci.yml` runs before anything publishes. |

`main` deliberately is *not* a clean upstream mirror: the release workflow only builds from `main`,
so that is where deployable code has to live. To contribute something back upstream, branch from
`upstream/main` directly rather than from our `main`.

```bash
git remote -v
# origin    git@github.com:patrickdundas/tracker-tracker.git
# upstream  https://github.com/jordanlambrecht/tracker-tracker.git

# sync with upstream
git fetch upstream && git merge upstream/main
```

## Versioning

`release.yml` publishes only when `package.json`'s version has no matching GitHub Release, so
**every deployable change needs a version bump** or no image is built.

This fork uses a `-homelab.N` suffix (`2.8.9-homelab.1`) so builds are unambiguously ours and never
collide with an upstream release tag. On an upstream sync, `package.json` will conflict on this one
line — resolve to the new upstream base plus a reset suffix, e.g. `2.9.0-homelab.1`.

## Deltas from upstream

| Change | Status |
|---|---|
| Upstream PR #175 merged whole (Zenith, BTN fix, IPTorrents, TorrentLeech adapters) | done — see below |
| TorrentLeech `hitAndRuns` | **the point of the fork**, not yet implemented |
| TorrentLeech `requiredRatio` / `warned` | stubbed `null` upstream; `warned` feeds the `warned` notification event |

**On taking #175 whole rather than extracting only TorrentLeech:** all four adapters touch the same
shared files (`src/lib/adapters/index.ts`, `adapters/constants.ts`, `lib/parser.ts`). Cherry-picking
TL alone would leave this fork carrying divergent copies of those, guaranteeing conflicts when
upstream merges #175. Taken whole, that merge becomes a no-op. The unused adapters never execute
unless those trackers are configured.

## One-time setup gotcha

GitHub **disables workflows on forks by default**. `total_count` from
`/repos/:owner/:repo/actions/workflows` reads 0 and nothing runs until they are enabled once from
the repo's Actions tab. There is no REST endpoint for this.
