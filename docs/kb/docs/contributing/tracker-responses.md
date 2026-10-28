# Tracker API Responses

This section shows the raw JSON responses from each tracker platform's API and how the adapter maps those fields to the shared `TrackerStats` interface. Use it when adding a new tracker or debugging why a field isn't mapping correctly.

Source of truth: `src/lib/tracker-platforms/adapters/`

---

## TrackerStats Interface

All adapters return `TrackerStats` defined in `src/types/tracker-stats.ts`.

```typescript
interface TrackerStats {
  username: string
  group: string | null
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  seedingCount: number | null
  leechingCount: number | null
  seedbonus: number | null
  hitAndRuns: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null
  remoteUserId?: number
  joinedDate?: string
  lastAccessDate?: string
  shareScore?: number
  avatarUrl?: string
  platformMeta?: PlatformMeta
}
```

Fields marked `null` indicate the tracker doesn't expose that data. We return `null` explicitly, not `undefined` or `0`.

## Platform Reference

- [UNIT3D API Response](tracker-responses-unit3d.md)
- [Gazelle API Response](tracker-responses-gazelle.md)
- [GGn API Response](tracker-responses-ggn.md)
- [MAM API Response](tracker-responses-mam.md)

---

## Adding a New Tracker Platform

For a brand new platform (not just a new tracker on an existing one):

1. Create `src/lib/tracker-platforms/adapters/{platform}.ts` implementing `TrackerAdapter`
2. Add response interface(s) at the top
3. Update `src/types/tracker-stats.ts` with new `platformMeta` fields if needed
4. Register in `src/lib/tracker-platforms/index.ts` (`getAdapter()` factory)
5. Add the platform to `VALID_PLATFORM_TYPES` and `DEFAULT_API_PATHS` in `src/data/platform-types.ts`
6. Add tracker entries in `src/data/trackers/`
7. Document the response shape here, redacted as [Sharing a Response Sample](#sharing-a-response-sample) describes

For a new tracker on an existing platform (i.e., a new UNIT3D site), just add an entry in `src/data/trackers/`.

---

## Sharing a Response Sample

A pull request or issue that adds a platform needs a sample of the tracker's real response. So does one for a tracker whose response differs from the example on its platform's page, which usually shows up as a poll failing with "Tracker returned an unexpected response" or a stat coming out wrong. Without a sample there is no way to check the adapter against what the tracker actually sends. A tracker on a supported platform that polls cleanly doesn't need one.

The sample ends up on the platform's page here and in the adapter's test fixture, so it stays in the repository's history for good. Redact it before you post it anywhere.

Keep every key and the format of every value. The adapter cares whether `uploaded` is a humanized string like `"500.25 GiB"` or a raw number, whether `ratio` is a string or a number, and whether an absent field is `null` or left out. It does not care about the values themselves, so replace these:

- Username, user ID and email
- IP addresses
- Passkey, authkey, RSS key, IRC key and API token
- Cookies and session values
- Any URL that carries one of the above, such as an announce URL, an RSS link or an avatar URL
- Invite links and codes

Keep each placeholder the same type as the value it replaces. A username becomes `"ExampleUser"`, a user ID becomes `12345`, and a key becomes `"[redacted]"`.

Leave the request out. A copied curl command or request URL carries your API token (UNIT3D sends it as `?api_token=`, GGn as `?key=`), and copied request headers carry your cookies.

For an HTML page, include only the elements the adapter reads. Page headers and footers often show your username and IP, and the RSS links in them carry your passkey.

### Capturing the Response

If the tracker runs on a JSON platform we already support, add it in the app, open its tracker page and click the bug icon. The **Raw Response** tab shows the body the tracker returned, with `passkey`, `authkey`, `ip`, `email`, `irckey`, `torrent_pass` and API key fields already replaced by `[redacted]`. That match is on exact key names, so it leaves your username, user ID and avatar URL alone and misses a secret stored under any other name or inside a URL. Scrub those by hand before you copy it.

For the HTML-scrape platforms the tab shows the parsed stats, not the page. Save the page from your browser instead, and trim it as described above.

For a new platform there's no adapter to run yet. Capture the response with your browser's developer tools or curl, and redact all of it by hand.

### If Something Leaks

Editing it out is not enough. Anyone who can read the repository can open a comment's edit history. You can delete the revision from that history, but someone may have copied the value already, so treat it as public and rotate it on the tracker. Reset your passkey, generate a new API key, or log out to end the session.
