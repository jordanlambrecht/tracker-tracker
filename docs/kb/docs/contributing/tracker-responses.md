# Tracker API Responses

This section shows the raw JSON responses from each tracker platform's API and how the adapter maps those fields to the shared `TrackerStats` interface. Use it when adding a new tracker or debugging why a field isn't mapping correctly.

Source of truth: `src/lib/adapters/`

---

## TrackerStats Interface

All adapters return `TrackerStats` defined in `src/lib/adapters/types.ts`.

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
  remoteUserId?: number
  joinedDate?: string
  lastAccessDate?: string
  shareScore?: number
  avatarUrl?: string
  platformMeta?: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta | MamPlatformMeta
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

1. Create `src/lib/adapters/{platform}.ts` implementing `TrackerAdapter`
2. Add response interface(s) at the top
3. Update `src/lib/adapters/types.ts` with new `platformMeta` fields if needed
4. Register in `src/lib/adapters/index.ts` (`getAdapter()` factory)
5. Add platform to the `platform` enum in `src/lib/db/schema.ts`
6. Add tracker entries in `src/data/trackers/`
7. Document the raw response shape here

For a new tracker on an existing platform (i.e., a new UNIT3D site), just add an entry in `src/data/trackers/`.
