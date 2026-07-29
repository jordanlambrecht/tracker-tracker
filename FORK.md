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

## Workflow edits (the main sync-conflict surface)

`.github/workflows/release.yml` is patched. Upstream's version **cannot publish from a fork** —
these are not preferences, they are blockers:

| Change | Why |
|---|---|
| Removed "Log in to Docker Hub" step | No `DOCKERHUB_*` secrets here. `docker/login-action` fails on empty credentials, aborting the job **before** the build/push step ever ran. |
| Removed `docker.io/jordyjordy/*` image tags | That is upstream's Docker Hub namespace; this fork has no rights to push there, so `build-push` failed. GHCR only now — `IMAGE_NAME` already resolves to our own repo path. |
| Removed "Sync README to Docker Hub" step | Same missing secrets, and it targets upstream's Docker Hub repo. |
| Trivy `exit-code: "0"` + `if: always()` on the SARIF upload | The image is pushed *before* the scan runs, so a hard failure never prevented a vulnerable image shipping — it only skipped the SARIF upload and the GitHub Release, leaving the run permanently red and the findings invisible in the Security tab. Non-blocking puts them where they can be acted on. |
| `platforms: linux/amd64` only, QEMU setup step removed | The single deploy target (yams) is x86_64. arm64 was emulated under QEMU for an image nothing pulls, and emulation is several times slower than native. Re-add both if an ARM host ever needs this. |
| **Cache scope fix** — `cache-from`/`cache-to` both `buildx-amd64` | Upstream wrote `cache-to: scope=buildx-<version>` but read `cache-from: scope=buildx-amd64,buildx-arm64`. The scopes never matched, so **no release ever read a cache entry another release wrote** — every build was cold, and each left a version-scoped entry nothing would read again. Worth upstreaming. |

### Release build time

The Docker build step was **989s of an 18m25s run** — every other step totalled ~90s. Both changes
above target that one step: dropping the emulated arm64 half, and making the layer cache actually
hit on subsequent builds.

Because this file is modified, **review `git diff upstream/main -- .github/` on every sync** and
re-apply these if upstream rewrites the release job. Reviewing that diff is worth doing regardless:
merging upstream runs *their* workflow code with this repo's `contents: write` and `packages: write`
token.

## Known issue: devDependencies ship in the production image

The `schema-deps` Dockerfile stage runs a full `pnpm install` (devDependencies included) and the
runner stage copies that `node_modules` in for the drizzle-kit schema push. So vitest's entire
dependency tree — vite, jsdom, undici — lands in the production image, and Trivy flags it.

Upstream already works around symptoms of this (see the esbuild block in `.trivyignore`). The real
fix is to install only what schema-sync needs in that stage. **Not attempted yet**: schema-sync runs
at container startup via `docker-entrypoint.sh`, so getting it wrong breaks deploys, not just builds.

Interim: `undici` is pinned to a patched `^7.28.0` via `pnpm.overrides`. `vite` could not be moved
the same way — vitest 4.1.4 holds it at 7.3.2 and neither `overrides` nor `--force` re-resolves it —
so its CVE is documented in `.trivyignore` instead. That one is genuinely inert here: it is a
dev-server bug on Windows, and this image is Linux running Next.js standalone.

Known non-blocking CI failures on this fork:

- **Scan Dependencies** (`dependency-review-action`) — needs Dependency Graph, which GitHub disables
  by default on forks. Enable under Settings → Code security, or ignore.
- **Trivy CVEs** in `undici` and `vite`, inherited from upstream's lockfile. Not introduced here.
  Real exposure is low for this deployment (LAN-only, no SOCKS proxy configured, not Windows), but
  they should clear when upstream bumps deps.

## One-time setup gotcha

GitHub **disables workflows on forks by default**. `total_count` from
`/repos/:owner/:repo/actions/workflows` reads 0 and nothing runs until they are enabled once from
the repo's Actions tab. There is no REST endpoint for this.
