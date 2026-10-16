# Tracker adapter standard

What a tracker adapter must do, written from what the thirteen existing adapters actually do. If
you are adding a **site**, you probably want [adding-a-tracker.md](adding-a-tracker.md) instead;
most new sites need a data file and no code at all.

> `src/data/trackers/` says what a tracker **is**. `src/lib/tracker-platforms/` says how it is **polled**.
> If your change is a site, it is one file in `src/data/trackers/` and you never open `src/lib`.
> If your change is a new way to poll, it is one file in `src/lib/tracker-platforms/adapters/`, and the shared code
> it may call lives in `src/lib/tracker-platforms/helpers/`.

---

## 1. What an adapter is, and is not

An adapter turns one tracker **protocol** into a `TrackerStats`. It is not the place for facts
about a site. Those live in `src/data/trackers/`, one file per site, as plain data: name, URL,
ratio rules, user classes, content categories, logo. That folder holds 55 entries plus
`_template.ts` and the `index.ts` barrel.

**One adapter usually serves many sites.** `unit3d` serves 19, `gazelle` 9, `avistaz` 5,
`nebulance` 2. The other nine adapters serve one site each today, but that is a fact about the
world, not a licence to hardcode. If your site runs a platform that already has an adapter, you
are adding a data file.

**Per-site variation is configuration, not a branch.** `buildFetchOptions` in
`src/lib/tracker-platforms/index.ts` reads `unit3dAuthStyle`, `gazelleAuthStyle`, `gazelleEnrich` and
`nebulanceAuthParam` off the registry entry and passes them in `options`. No family adapter
contains a hostname test, and none should gain one.

---

## 2. The required contract

```ts
export interface TrackerAdapter {
  fetchStats(baseUrl, apiToken, apiPath, options?): Promise<TrackerStats>
  fetchRaw(baseUrl, apiToken, apiPath, options?): Promise<DebugApiCall[]>
}
```

All thirteen implement both. `fetchRaw` is still declared optional at
`src/lib/tracker-platforms/contract.ts`; treat it as required.

### 2.1 The null versus zero rule

> **`null` means the tracker does not report this figure. `0` means the tracker reported zero.
> Never write a literal `0`, `false` or `true` into a field because the response did not carry
> one.**

This is the most important rule here. It has already caused shipped bugs (`9f8aaa5`, `c83f96c`).
A run of fabricated zeroes cannot be told apart from an account that genuinely stopped seeding,
and it corrupts every chart drawn from snapshot history.

Seven `TrackerStats` fields are nullable for exactly this reason (`types.ts:15-21`):
`seedingCount`, `leechingCount`, `seedbonus`, `hitAndRuns`, `requiredRatio`, `warned`,
`freeleechTokens`. `ratio` is not among them; it is derived, never read (see 2.3).

| Forbidden | Why | Write instead |
|---|---|---|
| `field: value ?? 0` | Absent becomes a measured zero | `value ?? null` |
| `warned: x?.warned ?? false` | Absent becomes a reassurance the user is not warned | `typeof x === "boolean" ? x : null` |
| `parseInt(text, 10) \|\| 0` on scraped text | An absent row parses as `NaN`, which `\|\| 0` turns into zero | `tryParseCount(text) ?? null` |
| `parseFloat(x) \|\| 0` for a ratio | See 2.3 | `computeRatio(uploaded, downloaded)` |
| `x ?? 0` in a second call | Overwrites the honest `null` the first call set | `if (typeof x === "number") stats.f = x` |

**A JSON `null` on the wire is data, not an absent key.** If the API declares
`invites: number | null` and sends `null`, the tracker is stating the figure is unknown. Map it to
`null` in `TrackerStats` and `undefined` in `platformMeta`. Never to `0`.

**Byte totals are never coalesced.** Both are non-nullable `bigint`, so an absent or unreadable
total cannot be reported as unknown and has to fail the poll. A JSON adapter gets that from
`requireBytes` (3). A scraper throws when both totals are missing (the page is not a profile)
and again when exactly one is unreadable, with the `Unexpected response from <host>:`
prefix, the way `parseRetrotoonProfile` and `parseFilelistProfile` do. `?? 0n` on a byte total
is a violation and the conformance test flags it.

**One shape that looks like a violation and is not.** Say so in a comment so a reviewer does not
"fix" it: `|| 0` on a value that came out of a `\d+` capture. Unreachable. Delete it rather than
explain it.

**A secondary or enrichment call may only raise a field from `null` to a value**, never coalesce
an absent one down to a literal. Reference: `gazelle.ts:205-206`, guarding with
`typeof enriched.leechingCount === "number"`.

### 2.2 The rule does not stop at platformMeta

- A count the response omitted is **`undefined`**, and its key is omitted. Assign conditionally
  (`filelist.ts:172-175`) or coalesce with `?? undefined`.
- A boolean the response did not carry is **absent**, not `false` and not `true`. Capability flags
  gate what the UI tells a user they may do, and `tracker-events.ts` fires on a true-to-false
  transition, so a fabricated `false` invents a revocation and a fabricated `true` hides a real
  one. References: `hawke.ts:106-117`, `avistaz.ts:303-318`.
- A flag parsed out of HTML must come from a **positive match on both spellings**, never from the
  absence of one word. `avistaz.ts:313` guards the missing row but still derives `!== "no"`, so a
  site renaming the value to "Disabled" would report a revoked right as granted.
- `platformMeta` is `JSON.stringify`ed into the trackers row. `bigint` does not survive JSON, so
  store byte figures as `number`. Undefined members are dropped, which is what makes
  omit-when-absent work end to end.
- **Declare every optional-on-the-wire field optional in your meta interface.** A required
  `number` forces the adapter to invent a zero in order to compile, which is a defect in the type,
  not in the adapter.

**Return meta on every successful poll**, built from what you read this poll. The scheduler only
writes meta when the key is present, so omitting it leaves the previous poll's JSON in the
database indefinitely, and a field that disappears upstream must be allowed to clear. Reference:
`unit3d.ts:299-302`, which returns an object even when its one member is absent and says why.

If your tracker exposes nothing beyond `TrackerStats`, return no meta at all.

### 2.3 Derived values

- **`ratio` is `computeRatio(uploadedBytes, downloadedBytes)`.** Sites render an infinity glyph,
  `---` or `Inf` for a zero-download account, and `parseFloat` turns those into `0`, the worst
  ratio the app can hold, which then fires the ratio-danger alert.
- If you have a reason to prefer the tracker's reported ratio, the fallback must be `computeRatio`
  and a comment must say why. Reference: `hawke.ts:124-128`.
- **`bufferBytes` is `computeBufferBytes(uploaded, downloaded)`**, unless the platform reports a
  signed buffer of its own, in which case say so (`hawke.ts:129-132`).

### 2.4 Errors

Adapter errors are sanitized by `sanitizeNetworkError` before a user sees them, and the sanitizer
matches on wording. Wording is an interface, not prose.

- **A payload that could not be read** starts with `` `Unexpected response from ${host}: ` ``,
  naming the hostname. Documented at `unit3d.ts:187-189`. This is what makes the card say "Tracker
  returned an unexpected response" rather than "Poll failed". It applies to scrapers too.
- **Never put the word "invalid" in a message unless it really is a credential problem.** The
  sanitizer maps `/Credentials.*missing|invalid/i` to "Invalid credentials", so any message
  containing "invalid" anywhere will send the user to re-enter a working key.
- **Do not call `sanitizeNetworkError` yourself.** Throw the raw shape and let the caller classify.
- **Do not classify by matching digits or words in a message.** Read `response.status`, or check
  the error type. `helpers/errors.ts` records why `SessionExpiredError` is a class rather than a
  recognisable string. Prefix any tracker-supplied string before throwing it, or a remote body
  containing "invalid" decides the classification for you.
- **A body that fails to parse is not a connection failure.** `classifyFetchError` applies only to
  an error thrown by `fetch` or `proxyFetch`. Reference: `nebulance.ts:106-107`, where a
  `SyntaxError` becomes the shape wording and only the remaining branch is classified.
- **Log through `log` from `@/lib/logger`**, in the structured `log.warn({ err }, "message")`
  form, never `console`. The in-app event feed is built by parsing pino output, so a
  `console.warn` failure is invisible to the operator. Reference: `torrentleech.ts:210`.
- A `SessionExpiredError` from any call aborts the poll. Every other secondary-call failure is
  logged and leaves its fields `null`.

### 2.5 Credentials

- **Never write a credential into an `Error`, a log line, or a `DebugApiCall` `endpoint`, `data`
  or `error`.** The debug route scrubs only `data`; the rest depends on adapter discipline. No
  adapter leaks today, and that is worth keeping true.
- **Parse the credential blob outside the `try`** in `fetchRaw`, so a bad blob throws to the route
  instead of becoming a call entry. Reference: `filelist.ts:287-288`.
- **A JSON blob is parsed with `parseCredentialJson`**, declaring required fields in `fields` and
  per-account ones in `optionalFields`. Never call `JSON.parse(apiToken)` yourself.
- **A pasted Cookie header goes through `validateCookieHeader`.** It validates a whole header. An
  individual cookie **value** you interpolate yourself is outside its scope and needs your own
  semicolon and control-character guard.
- **A credential interpolated into a request header must be checked for control and non-ASCII
  characters first.** Reference: `validateMamId` (`mam.ts:83`). A token placed in a query
  parameter or POST body relies on `URLSearchParams` encoding and needs no such check.
- `userAgent` is **required** for a cookie scraper, because the session is fingerprinted against
  the agent it was issued to. It is **optional** for a JSON API, where the transport supplies one.

### 2.6 fetchRaw and the debug view

`fetchRaw` powers the debug dialog. It is the screen someone opens when a poll is failing, so it
must not lie.

- **Return the unmodified response body in `data`** for a JSON API. Mapping is `fetchStats`'s job.
  A scraper may substitute parsed output, because the raw artifact is a whole HTML page.
- **Apply every failure test `fetchStats` applies.** `adapterFetch` throws on a non-2xx, so the
  only failure reaching `fetchRaw` intact is one the tracker wrapped inside an HTTP 200 body, and
  the debug view marks a call healthy purely on `error` being null. Call `envelopeError(data)` and
  put its result in `error`, keeping the offending body in `data`. References: `gazelle.ts:285`,
  `ggn.ts:236`, `hawke.ts:163`. A tracker whose failure is a missing field rather than an envelope
  flag checks for itself (`mam.ts:210-217`).
- **Emit an entry for a call you skipped**, with `data: null` and a reason. A debug view that
  simply ends after one entry cannot be told from a one-call adapter.
- **Do not abandon later calls when an earlier one fails** if a cached value can satisfy the
  dependency. `options.remoteUserId` is that cached id, and a failing first call is exactly when
  the second call's output matters most.
- **Apply the same pacing `fetchStats` applies.** The debug route runs both methods in one
  request, so a missing pause means one press issues every request back to back.
- **Build the endpoint string first and derive the URL from it**, so the two cannot encode
  differently. Reference: `torrentleech.ts:470-475`.
- `label` is Title Case and names what the call fetches.

---

## 3. Shared helpers

Everything in `src/lib/tracker-platforms/helpers/` exists because at least two adapters had already written
it. Import it rather than writing it again.

| Helper | File | Use it for | Do not hand-roll |
|---|---|---|---|
| `adapterFetch` | `helpers/adapter-fetch.ts` | Every JSON API request on the happy path. Applies the shared timeout, default User-Agent and proxy, throws on non-2xx. | Your own fetch, timeout, proxy branch or non-2xx message |
| `adapterRequest` | `helpers/adapter-fetch.ts` | Same, but returns a non-2xx instead of throwing. Only when your API reports errors in the body of a non-2xx. | Reaching for this by default |
| `fetchTrackerHtml` | `helpers/html-fetch.ts` | Every authenticated page fetch in a scraper. Handles headers, cookies, the redirect chain, the off-origin refusal. | A private fetch with a Cookie header, your own redirect following |
| `envelopeError` | `helpers/envelope.ts` | `fetchRaw`, on every body that arrived with HTTP 200. Returns the failure a tracker signalled inside a success, or null. Covers `{status, error}` and `{success, message}`. | Your own `status !== "success"` unwrap inside `fetchRaw` |
| `normalizeWhitespace` | `helpers/html-parse.ts` | Any text you compare against a literal label. Labels carry U+00A0, which an exact match will not survive. | `value.replace(/\s+/g, " ").trim()` |
| `datePrefix` | `helpers/html-parse.ts` | Slicing `YYYY-MM-DD` off a site-printed datetime | Your own date regex |
| `tryParseCount` | `helpers/html-parse.ts` | Any site-printed count. The first number in the text, commas stripped, decimals and sign kept, `undefined` when there is none. | `parseInt(text, 10)` with your own `NaN` test |
| `tryParseSiteBytes` | `helpers/html-parse.ts` | Site-printed byte totals. Strips grouping commas and canonicalises the unit, so both `1,024 kB` and `1 GiB` parse. Returns `undefined` rather than throwing. | A private `parseBytes` wrapper with its own tolerances |
| `requireBytes` | `helpers/bytes.ts` | A byte total a JSON API is contracted to send. Throws naming the host and the field when it is absent or not a number, because both byte totals are non-nullable `bigint` and cannot hold unknown. | `floatBytesToBigInt` straight off the wire, which answers `0n` for an absent field |
| `computeRatio`, `computeBufferBytes` | `@/lib/data-transforms` | `ratio` and `bufferBytes` | Reading the tracker's ratio with no `computeRatio` fallback |
| `parseCredentialJson` | `helpers/cookie-credentials.ts` | Any credential arriving as a JSON blob | `JSON.parse(apiToken)`, shape checks, and above all the error wording |
| `validateCookieHeader` | `helpers/cookie-credentials.ts` | A credential that is a pasted Cookie header | Prefix stripping, control-character and non-ASCII guards |
| `SessionExpiredError` | `helpers/errors.ts` | Signalling that an authenticated request came back as a login page. Callers use `instanceof`. | Matching the message text |
| `classifyFetchError` | `@/lib/error-utils` | Errors thrown by `fetch` or `proxyFetch`, only | Applying it to a `JSON.parse` failure |
| `log` | `@/lib/logger` | Every log line in the adapter layer | `console.warn`, `console.error` |
| `metaFor` | `@/types/tracker-stats` | Narrowing `platformMeta` **outside** the adapter that produced it | `meta as XPlatformMeta` in a component |

The interface an adapter implements is `contract.ts` at the module root. Adapters import it as
`../contract`; helpers import it the same way.

**The count parser is settled.** `tryParseCount` returns `undefined`, not `null`, because
`platformMeta` is `JSON.stringify`ed into the trackers row: an undefined member is dropped, a null
one is stored. A null-returning parser would write the key back on every poll and defeat
omit-when-absent (2.2). `TrackerStats` fields coalesce with `?? null` where they are assigned.

Four private number parsers remain. Each reads a different input shape, so folding them in would
break them:

- `ratioBarNumber` (`avistaz.ts`) scans ratio-bar items with a label regex.
- `parenCount` (`torrentleech.ts`) reads the number inside parentheses.
- `trailingCount` (`torrentleech.ts`) reads the **last** number in a cell; `tryParseCount` takes
  the first.
- `toNumber` (`unit3d.ts`) reads a JSON field that may already be a number. Passing one to
  `tryParseCount` throws.

All four return `null` because each value goes straight into a `TrackerStats` field (2.1). Reach
for `tryParseCount` unless you are in one of those four shapes.

**One helper that does not exist yet.** If you need it, promote it into `helpers/html-parse.ts`
rather than adding another private copy:

- The **Cloudflare challenge predicate**. The same three-condition test is copied in all five
  scrapers, and three of them already throw the identical message.

---

## 4. Naming and file shape

**Settled, not open questions.** Line 1 is the file's own path comment. The class is last,
exported, and declares `fetchStats` before `fetchRaw`. The `fetchRaw` catch fallback is
byte-identical everywhere: `err instanceof Error ? err.message : "Request failed"`. All five
scrapers name their transport wrapper `fetchHtml`. Tests use `vi.spyOn(global, "fetch")` with
`vi.restoreAllMocks()` in `beforeEach`, and there are no skipped or `.only` tests.

| Rule | Dominant | Deviation |
|---|---|---|
| Class name flattens the filename | 11 of 13 | `GGnAdapter` and `DigitalCoreAdapter` keep the site's real casing. Do not rename them; the names are public. New adapters flatten. |
| Helpers are module-scope functions | 12 of 13 | `gazelle.ts` puts one helper on the class as a `private async` that never touches `this`, so it cannot be unit-tested directly. |
| A prefix predicts the failure mode | Mixed | `parse*` throws, `tryParse*` returns `undefined`. Whatever it is called, "not reported" must reach `TrackerStats` as `null`. |
| Label lookups compare exactly on normalized text | filelist, retrotoon | A bare `.includes(label)` matches any cell containing it, so "Last Access IP" satisfies a "Last Access" lookup. Normalize, then compare exactly, or anchor the regex. |
| Ignoring the persisted `_apiPath` | 7 adapters | When the path is intrinsic to the platform, ignore `_apiPath` so a stale persisted value self-heals, and say so in one comment naming **your** intrinsic path. |
| Date shape | No convention | Emit one shape and say which. The scheduler preserves a bare `YYYY-MM-DD` exactly as printed (`trackerDateStr`). Adapters still emit three shapes. |

**The `Functions:` file header.** 10 of 13 adapters carry one and 4 of those are already wrong.
Either generate and verify it in CI (7.7) or drop it. A manifest that is wrong half the time is
worse than none, because a contributor trusts it and writes a duplicate helper. The path comment
on line 1 stays either way.

**Comments.** `filelist.ts` is the calibration reference. A comment states the constraint the
current code must satisfy. It does not narrate what the code used to do; git records that. No em
dashes.

---

## 5. Pre-submit checklist

**Scope**

- [ ] Every fact about the site is in `src/data/trackers/<slug>.ts`, not in the adapter.
- [ ] My site is not already served by `unit3d`, `gazelle`, `avistaz` or `nebulance`.
- [ ] Per-site variation is read from `options`, backed by a registry flag. No hostname branch.

**The contract**

- [ ] Every unreported numeric field is `null`. No `?? 0`, `|| 0` or `parseInt(...) || 0` on a
      nullable `TrackerStats` field.
- [ ] `warned` is `null` unless the response carried an actual boolean.
- [ ] `ratio` is `computeRatio(...)`, or the reported ratio with `computeRatio` as fallback and a
      comment saying why. No `|| 0` anywhere in the ratio expression.
- [ ] I never coalesce a byte total; a missing or unreadable one throws with the `Unexpected response from` prefix.
- [ ] In `platformMeta`, an omitted figure is `undefined` and its key absent. No fabricated
      booleans. Byte figures are `number`.
- [ ] My meta interface declares every optional-on-the-wire field optional.
- [ ] `platformMeta` is returned on every successful poll, not guarded on emptiness.
- [ ] A secondary call only raises a field from `null` to a value.

**Errors and credentials**

- [ ] Every "could not read the payload" error begins with `Unexpected response from <host>: `.
- [ ] No message contains "invalid" unless it is genuinely a credential fault.
- [ ] I do not call `sanitizeNetworkError` myself, and I classify on `response.status` or an error
      type, never on digits in a message.
- [ ] `classifyFetchError` is applied only to a `fetch` or `proxyFetch` rejection.
- [ ] A tracker-supplied error string is prefixed before it is thrown.
- [ ] I parse credentials with `parseCredentialJson`, and a pasted header with
      `validateCookieHeader`. I never call `JSON.parse(apiToken)`.
- [ ] A credential I interpolate into a header is checked for control and non-ASCII characters.
- [ ] No credential appears in any error, log line, or debug `endpoint`, `data` or `error`.
- [ ] Any call I make directly carries `ADAPTER_FETCH_TIMEOUT_MS`. Calls through `adapterFetch`
      and `fetchTrackerHtml` get it automatically.
- [ ] I log through `log` from `@/lib/logger`. There is no `console.` in my file.

**fetchRaw**

- [ ] Credentials are parsed outside the `try`.
- [ ] For a JSON API, `data` is the unmodified response body.
- [ ] Every 200-body failure test in `fetchStats` is applied here, via `envelopeError` or an
      explicit check, and sets `error`.
- [ ] A skipped call still gets an entry with `data: null` and a reason.
- [ ] `endpoint` is built first and the URL derived from it.
- [ ] Any pause or backoff in `fetchStats` is applied here too.

**Shape and tests**

- [ ] Line 1 is my file's path comment. The class is last and declares `fetchStats` then
      `fetchRaw`.
- [ ] I import the shared helpers rather than re-implementing them.
- [ ] Label lookups normalize whitespace and compare exactly, or use an anchored regex.
- [ ] A colocated `<name>.test.ts` exists with one `describe("XAdapter.fetchRaw")` block.
- [ ] **Every field I hardcode to `null` has a matching `expect(stats.f).toBeNull()`.**
- [ ] A test omits the source key entirely for any coalescing path I kept.
- [ ] A timeout rejection is asserted to produce a message naming my tracker's host.
- [ ] My fixture states where it came from and on what date.
- [ ] No em dash, no `.only`, no `.skip`.
- [ ] `pnpm tsc` and `pnpm test:run` pass. Both block CI.
- [ ] `biome check .` reports nothing new. The tree currently carries 0 errors and 12 warnings;
      compare against that baseline.

---

## 6. Known outstanding work

Short and current. Everything else the audit found is fixed, and most of what was here is now
enforced by section 7 rather than remembered.

1. **Adapters still emit three different date shapes.** The scheduler no longer corrupts a bare
   date, so this is now consistency rather than correctness. Pick one shape and say which.
2. **`digitalcore.ts` still hand-rolls its credential parser.** Allowlisted in the conformance
   test with its reason: its messages and cookie-injection guards differ deliberately from
   `parseCredentialJson`. Reconciling the wording would let the allowlist entry go.

## 6a. Calls made without documented intent

Most of the rules above were recovered from comments the original authors left at the site that
invented them. Where a reason was written down it was followed, and where a deviation was
deliberate it was declared rather than removed: DigitalCore's hand-rolled credential parser is
allowlisted in the conformance test, BTN's fixed API host is declared in the contract test's
registry, AvistaZ's `strictParseBytes` still throws where its siblings return undefined, and MAM's
`?? 0` inside a guarded sum is allowlisted.

These, by contrast, were changed on a consistency argument with no evidence either way. They are
recorded here so the next person inherits the reasoning instead of re-deriving it, and so anyone
who knows the original intent can say so.

| Change | What was inferred | The tradeoff |
|---|---|---|
| Gazelle takes the 1500ms pause in `fetchRaw` too | That its absence was an oversight | The debug route runs `fetchRaw` and `fetchStats` in one request, so one press issued four calls back to back at a site strict enough to need a pause between two of them. The cost is 1.5s of extra latency on an interactive screen, and a fast debug view may have been the point. |
| GGn's `enabled` is `undefined` when absent, not `true` | That defaulting in two directions from one missing object was incoherent | `enabled ?? true` may have been deliberate optimism: better to assume an account works than to show a false disabled badge on a response that merely omitted the field. |
| FileList and RetroToon return `platformMeta` even when empty | That the guard was an oversight | `unit3d.ts` documents the always-return choice and its reason; these two carried no comment. But it is a tradeoff, not a pure fix: a page that parses yet yields no meta now clears the stored values instead of keeping the last known good. |
| DigitalCore's enrichment guards `leechingCount` | That it should match Gazelle's identical guard | Unresolved contradiction: the comment at the first call says DigitalCore reports no leeching count at all, while the enrichment reads one from the profile endpoint. One of the two is wrong and the code does not say which. `peersLeecher` may mean peers leeching from your seeds rather than torrents you are leeching. |
| BTN's `HnR` is `null` when unparseable, not `0` | That a present-but-unparseable count is a tracker fault | Marginal. The field was already null-guarded for absence; this only changes the case where BTN sends something that is not a number. |

The pattern worth remembering: where a decision was written down it was found, and where it was
not, intent was inferred from consistency. Consistency is a weaker signal than it looks. If you
make a call like these, leave the comment.
## 7. What can be enforced mechanically

This is the part that matters for a crowdsourced surface. Review attention does not scale, and
four of ten drifted `Functions:` headers are the proof. Two precedents already exist:
`src/data/__tests__/tracker-registry.test.ts` is a CI conformance test that reads the crowdsourced
data files and fails the PR on a bad entry, and `biome.json` already carries an error-level
`noRestrictedImports` with a scoped `overrides` block.

Ordered by value per unit of effort.

### 7.1 Let the type system carry the rule

| Change | Enforces |
|---|---|
| `fetchRaw?` becomes `fetchRaw` on `TrackerAdapter` (`types.ts:308`) | An adapter without a debug path stops compiling. All 13 already implement it, so this is free. |
| `platformMeta?: PlatformMeta` instead of restating the ten-member union | A new meta type can no longer be added to one list and missed in the other. |
| `PlatformMetaMap` keyed `Partial<Record<PlatformType, ...>>` | An unknown platform key fails to compile, where today it is silent. |

**Done.** `fetchRaw` is required, the ten-member union is declared once, a compile-time assertion
rejects a meta registered under a platform that does not exist, and `GazelleCommunity`'s comment
counts are optional, so no type forces a fabricated zero.

### 7.2 A shared behavioural contract test (done)

One file iterating `VALID_PLATFORM_TYPES` minus `custom` through `getAdapter`. Per adapter:

| Check | How | Catches |
|---|---|---|
| **No credential leak** | Build a credential containing a unique canary. Mock `fetch` to reject and to return 401. Assert no `label`, `endpoint`, `error` or thrown message contains the canary. | The rule that today depends entirely on adapter discipline. The most valuable check here. |
| **Timeout names the host** | Mock `fetch` to reject with a `TimeoutError`. Assert the message contains the hostname. | All 13 at once. |
| **`fetchRaw` shape** | Every entry has a string `label`, a string `endpoint`, and an `error` that is a string or null. | Structural drift in the debug contract. |
| **Title Case label** | `/^[A-Z]/` on every label. | Future repeats. |
| **Bad credentials throw** | Pass a malformed blob to `fetchRaw`, assert it rejects rather than resolving with a call list. | The "parse outside the try" rule, currently unanimous and unprotected. |

**Done**, in `__tests__/adapters.contract.test.ts`. It iterates `VALID_PLATFORM_TYPES` through
`getAdapter`, so a new adapter inherits every rule without anyone remembering to write these cases
again. Adding an adapter without adding a credential to its fixture registry fails the first case,
which is deliberate: that registry is the one place a contributor declares what their adapter needs
to be driven. It found two BTN divergences on its first run.

### 7.3 A source-text conformance test (done)

Same shape as `tracker-registry.test.ts`, over `src/lib/tracker-platforms/`:

No counts here on purpose. `__tests__/conformance.test.ts` computes them on every run, and a
number written down goes stale the moment someone fixes something, telling the next contributor a
rule is aspirational when it is already green.

| Assertion | Notes |
|---|---|
| Line 1 equals `// ` plus the file's own path | A unanimous convention, locked in. |
| No U+2014 | Prose review cannot see an em dash reliably. Covers the test files too. |
| No banned word | Locked in at zero cost. |
| No `JSON.parse(apiToken` outside `helpers/` | Scoped to `adapters/`, where `parseCredentialJson` is the only sanctioned route. |
| `/\?\?\s*(0\|false\|true)\b/` against a small allowlist | The null versus zero rule. The allowlist is the point: adding a coalescing default means adding a line with a reason, which turns a silent choice into a reviewable one. `?? 0n` is in scope: a byte total is never coalesced. |
| Each `<name>.test.ts` calls `.fetchRaw(` | Every adapter's debug path is exercised somewhere. |
| Every logic-bearing file in `helpers/` has a colocated test | `errors.ts` is declaration-only and exempt. |
| The `Functions:` header lists every function the file declares | Closes 7.7 for the files that carry a header. |
| `adapters/` holds adapters and nothing else | The layout rule itself. |

`console.` is not in the list. Biome owns it (7.5), at error level across the module including the
test files. Two enforcers means the weaker one gets edited when it fires.

**Done**, in `__tests__/conformance.test.ts`. Failures name the file and the matched text so the
message teaches the rule. Two allowlist entries survive, each with its reason written next to it:
DigitalCore's hand-rolled credential parser, and MAM's category sum. Adding a third means writing
down why, which is the whole point.

### 7.4 A null-contract test generated from the source

For each adapter, parse the source for fields assigned a literal `null` in the returned
`TrackerStats`, then assert the colocated test contains a matching `expect(...).toBeNull()`. Most
adapters already comply, so it starts mostly green, and it makes "a contributor changes
`requiredRatio: null` to `requiredRatio: 0` and the suite stays green" impossible. Regex over both
files, no AST needed.

### 7.5 Biome rules (done)

`biome.json` already uses `overrides` with `includes`, so scoping is a two-block edit.

- `suspicious/noConsole` at error level, scoped to `src/lib/tracker-platforms/**`.
- `style/noRestrictedImports` scoped to `src/lib/tracker-platforms/adapters/*.ts` (adapters only, not `helpers/`),
  banning a direct `@/lib/tunnel` import with a message pointing at `adapterFetch` and
  `fetchTrackerHtml`. One current exception, `torrentleech.ts`, which calls `proxyFetch` directly
  for its login POST, so it needs its own override entry. That exception being visible in
  `biome.json` is itself the documentation.

**Done.** `noConsole` is an error across the module, and `noRestrictedImports` bans a direct
`@/lib/tunnel` import from `adapters/*.ts` with `torrentleech.ts` declared as its own override. The
`$schema` is bumped to 2.5.10 to match the installed version.

### 7.6 Targeted helper tests

- **Done:** `helpers/html-parse.test.ts` now exists and drives both unit families through
  `tryParseSiteBytes`. Its absence is why the binary-unit defect stayed invisible.
- **Done:** a date-shape test pins that a bare `YYYY-MM-DD` survives unchanged.
- Add an assertion to `helpers/html-fetch.test.ts` that `proxyFetch` receives
  `timeoutMs: ADAPTER_FETCH_TIMEOUT_MS`, so the two transports cannot drift.

### 7.7 Verify the `Functions:` header, or drop it

**Done**, in `__tests__/conformance.test.ts`. It fails on any function the header omits. A file
with no header is left alone, so dropping the header still complies.

It only catches omissions. A name left in the header after its function is deleted passes, so that
edit is still by hand.

### 7.8 What still needs a human

State these plainly so review attention goes where it is actually needed: whether a site is really
a new platform or a fork of an existing one; whether a selector is stable or incidental to one
page render; whether a fixture was captured or hand-rebuilt; and whether a comment states a
present constraint or narrates history.
