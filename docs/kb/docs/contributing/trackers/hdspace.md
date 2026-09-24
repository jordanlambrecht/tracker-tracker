# HD-Space (HDS)

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Platform     | HD-Space (custom, xbtit)                                 |
| Base URL     | `https://hd-space.org`                                   |
| API Endpoint | `https://hd-space.org/index.php?page=usercp` (HTML)      |
| Auth Method  | Browser cookies (`cf_clearance` + site session) + User-Agent |
| Enrichment   | No — one page carries everything                         |
| Auth Style   | N/A                                                      |

## Notes

HD-Space runs a customised **xbtit** codebase with no API, and the site sits
behind a Cloudflare **managed challenge that blocks every non-browser client**
(verified 2026-09-23: `403` + `cf-mitigated: challenge` on the first GET, with
or without browser-like headers). A server-side username/password login can
therefore never reach the site. The adapter follows the AvistaZ/IPTorrents
model instead: the user pastes their browser's Cookie header — which must
include Cloudflare's `cf_clearance` (valid for **one year** on this site) and
xbtit's own session cookies — and the app captures the browser's User-Agent,
which `cf_clearance` is bound to. Requests must come from the same public IP as
the browser that minted the cookies. One page is read per poll, the user
control panel.

Everything comes from the header block xbtit renders on every authenticated
page plus one row of the panel:

| Stat                  | Source                                                |
| --------------------- | ----------------------------------------------------- |
| username              | `Welcome back <name> (Logout)` in the header          |
| class (`group`)       | `Rank: …` in the header                               |
| uploaded / downloaded | `UP: 22.01 GB` / `DL: 10.90 MB`                       |
| ratio, buffer         | derived from the byte totals (the page prints `∞`)    |
| seeding / leeching    | `Active Torrents : 16 0` (two counts after the icons) |
| seedbonus             | `Bonus: 11,673.65`                                    |
| joined date           | `Joined on: September 03, 2026, 17:10:02` (panel row) |
| remote user id        | the `page=usercp&uid=…` link                          |

xbtit has no hit-and-run system, warnings, required ratio or freeleech tokens,
so those stay `null`.

### Byte units

xbtit labels sizes `KB` / `MB` / `GB` but computes them in binary (1024-based):
for a header reading `UP: 22.01 GB`, `DL: 10.90 MB`, the site's own ratio is
2,067.83 = 22.01 / 10.90 × 1024. The adapter therefore maps the labels to
KiB/MiB/GiB before parsing, so uploaded/downloaded/ratio match the site.

### Cloudflare

The challenge applies to all non-browser clients (Prowlarr only passes through a
FlareSolverr/Byparr solver). When `cf_clearance` expires or the public IP
changes, the adapter reports "Cloudflare challenge detected — cf_clearance
cookie needs refreshing" rather than parsing the challenge page; paste fresh
cookies from the browser.

### Rate limiting

HD-Space returns `403 Forbidden - due to excessive requests` to automation
user-agents that make roughly ten requests in a few minutes. With the session
cached, one poll is a single GET, so the default 60-minute interval is far below
that limit; a re-login only happens when the cached session has expired.
