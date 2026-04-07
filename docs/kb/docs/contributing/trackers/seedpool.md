# Seed Pool (SP)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | UNIT3D                              |
| Base URL     | `https://seedpool.org`              |
| API Endpoint | `https://seedpool.org/api/user`     |
| Auth Method  | Query parameter: `?api_token=TOKEN` |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Standard UNIT3D setup, but Seed Pool has its own promotion system based on seedsize instead of upload amount. The class names are all pool-themed: User → Pool → PowerPool → SuperPool → UberPool → MegaPool → GodPool. There's also a ProPool class you can buy on IRC.

Fall below a 1.0 ratio and you'll hit `Cesspool` — you lose download privileges. `KiddiePool` is a timeout zone.

Check the status page at `https://status.seedpool.org/`.

## Slots

**Profile Card:** username · group (no avatar or join date — UNIT3D platform)

**Badges:** `warned` (conditional — only resolves when `warned === true` in snapshot)

**Stat Cards:** `seedbonus`

**Progress:** none
