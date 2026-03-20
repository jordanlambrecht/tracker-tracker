# Tracker API Responses

This section documents the raw JSON responses from each tracker platform's API and how the adapter maps those fields to the shared `TrackerStats` interface. Use it when adding support for a new tracker or debugging why a field is coming back wrong.

Source of truth: `src/lib/adapters/`

---

## TrackerStats Interface

All adapters return a `TrackerStats` object defined in `src/lib/adapters/types.ts`.

```typescript
interface TrackerStats {
  username: string
  group: string
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  seedingCount: number
  leechingCount: number
  seedbonus: number | null
  hitAndRuns: number | null
  requiredRatio: number | null
  warned: boolean | null
  freeleechTokens: number | null

  // Optional — populated when available
  remoteUserId?: number
  joinedDate?: string
  lastAccessDate?: string
  shareScore?: number
  avatarUrl?: string
  platformMeta?: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta
}
```

Fields marked `null` in the platform pages mean the platform does not expose that data — the adapter explicitly returns `null`, not `undefined` or `0`.

## Platform Reference

- [UNIT3D API Response](tracker-responses-unit3d.md)
- [Gazelle API Response](tracker-responses-gazelle.md)
- [GGn API Response](tracker-responses-ggn.md)

---

## Adding a New Tracker Platform

If you are adding support for an entirely new platform type (not a new tracker on an existing platform):

1. Create `src/lib/adapters/{platform}.ts` implementing `TrackerAdapter`
2. Add the response interface(s) to the top of the file
3. Add the new platform type to `src/lib/adapters/types.ts` if it needs new `platformMeta` fields
4. Register the adapter in `src/lib/adapters/index.ts` (`getAdapter()` factory)
5. Add the platform to the `platform` enum in `src/lib/db/schema.ts`
6. Add tracker registry entries in `src/data/trackers/` using the new platform type
7. Document the raw response shape in this section

For a new tracker on an existing platform (e.g. a new UNIT3D site), you only need to add an entry in `src/data/trackers/` — no adapter code required.
