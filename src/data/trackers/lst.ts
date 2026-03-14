// src/data/trackers/lst.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const lst: TrackerRegistryEntry = {
  slug: "lst",
  name: "LST",
  abbreviation: "LST",
  url: "https://lst.gg",
  description: "Community-built Movie/TV/Fanres database with a strong focus on HD content. Known for one of the best Fanres selections available. Hosts a 300TB+ public seedbox archive with dedicated 1Gbit connection.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "XXX", "Books", "Manga", "Education", "Fanres"],
  userClasses: [
    { name: "Leech", requirements: "Default (0 B seedsize, 0.00 ratio)" },
    { name: "Crab", requirements: "Seedsize path: 0 B seedsize, 0.40 ratio, 5 torrents seeding" },
    { name: "Goldfish", requirements: "Seedsize path: 100 GiB seedsize, 0.60 ratio, 1 month, seeding 1 week" },
    { name: "Lobster", requirements: "Seedsize path: 500 GiB seedsize, 0.70 ratio, 2 months, seeding 2 weeks" },
    { name: "Sailboat", requirements: "Seedsize path: 10 TiB seedsize, 1.00 ratio, 6 months, seeding 2 months, 25 torrents" },
    { name: "Ship", requirements: "Seedsize path: 20 TiB seedsize, 1.50 ratio, 1 year, seeding 3 months, 50 torrents" },
    { name: "Cargo Ship", requirements: "Seedsize path: 50 TiB seedsize, 2.00 ratio, 2 years, seeding 6 months, 75 torrents" },
    { name: "Dolphin", requirements: "Upload path: 10 TiB uploaded, 5 uploads, 1.00 ratio, 3 months, seeding 2 weeks 6 days, 20 torrents" },
    { name: "Whale", requirements: "Upload path: 25 TiB uploaded, 10 uploads, 1.00 ratio, 4 months, seeding 1 month, 25 torrents" },
    { name: "Leviathan", requirements: "Upload path: 50 TiB uploaded, 15 uploads, 1.50 ratio, 1 year, seeding 3 months, 50 torrents" },
    { name: "Cthulhu", requirements: "Upload path: 100 TiB uploaded, 20 uploads, 2.00 ratio, 2 years, seeding 6 months, 75 torrents" },
  ],
  releaseGroups: [
    { name: "L0ST", description: "Main inhouse group, focused on full discs" },
    { name: "KIMJI", description: "Focused on 1080p AV1 encodes" },
    { name: "coffee", description: "Focused on 1080p x264 and 1080p UHD x265 encodes" },
    { name: "SQS", description: "Focused on 1080p x265 encodes and WEB-DLs" },
    { name: "Yuki", description: "Focused on WEB-DLs" },
  ],
  bannedGroups: [
    "-ZR-", "4K4U", "Aisha", "Aisha@RFX", "Alcaide_Kira", "AOS", "ARCADE", "AV1D", "aXXo",
    "B3LLUM", "BHDStudio", "BiTOR", "BONE", "BRrip", "CM8", "CREATiVE24", "CrEwSaDe", "CTFOH",
    "d3g", "dAV1nci", "DepraveD", "DNL", "EGEN", "EVO", "FaNGDiNG0", "FGT", "flower",
    "FoxTorrentX", "GalaxyTV", "HD2DVD", "HDHub4u", "HDT", "HDTime", "iHYTECH", "ION10",
    "iPlanet", "iVy", "KaPPa", "KiNGDOM", "LAMA", "MeGusta", "mHD", "mSD", "NaNi", "NhaNc3",
    "nHD", "nikt0", "nSD", "OFT", "OldT", "PANDEMONiUM", "PHOCiS", "PiGNUS", "PRODJi", "PSA",
    "R&H", "RARBG", "Rifftrax", "SANTi", "SasukeducK", "seedpool", "SEEDSTER", "ShAaNiG",
    "Sicario", "SP3LL", "SPx", "STUTTERSHIT", "TAoE", "TEKNO3D", "TGALAXY", "TGx", "tokar86a",
    "TORRENTGALAXY", "ToVaR", "TSP", "TSPxL", "UnKn0wn", "ViSION", "VN_Foxcore", "VXT", "WAF",
    "WKS", "x0r", "YIFY", "YTS", "YTS.MX", "ZR",
  ],
  notableMembers: ["kolt343 (Owner)", "toxxic (Admin)", "x64 (Admin)", "Zips (Admin)"],
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 504,
    hnrBanLimit: 5,
    fullRulesMarkdown: `## Upload Rules, Slots & Trumping

### Prohibited Content
- Pre-retail content (screeners, telesyncs, CAMs, etc.). Officially released workprints allowed.
- Releases from banned groups or containing malware.
- RAR'd/archived releases. Extraneous files outside MKV (NFOs, samples, loose subs).
- Invalid hybrids (improper video/audio splicing, injected DV/HDR10+ layer mismatches).
- AI-generated/enhanced content (upscaled video, AI DV/HDR layers). Studio-retail AI processing is allowed.
- XXX must not use Movies/TV category.

### General Non-Disc Requirements
- **Container:** MKV required. Exceptions: .ts for UHDTV/HDTV/SDTV, MP4 for DV Profile 5 WEB-DL, XviD/DivX only when no other version exists.
- **Audio:** LPCM 3.0+ → DTS-HD MA or TrueHD + compat track. LPCM 2.0 → FLAC 2.0. No FLAC for multi-channel 3.0+ (except anime). Each TrueHD must include DD core. One default audio track.
- **Allowed audio:** Original language (first/default), English dub if non-English, original mixes/remixes, commentaries, interviews, novelty tracks, isolated score.
- **Subtitles:** English sub required for non-English titles without English dub (set Default: Yes). Forced subs only for original language (Forced: Yes, Default: No). English first, then alphabetical.

### Full Discs
- BDMV, HDDVD_TS, VIDEO_TS, ISO (3D only). Copy protection/region lock removed. Unmodified and complete.
- BDInfo required for BD/HD-DVD. IFO + VOB MediaInfo for DVDs.
- Unlimited slots (different content/region). Cannot be trumped by other formats.

### Remuxes
- Retail assets only, untouched except: framerate adjustment for audio sync, video/audio splicing for hybrids (with proof), subtitle re-timing/tone-mapping.
- Hybrid DV/HDR10+ remuxes get dedicated slot alongside disc-sourced. Must include grade check + HDR10+ plot.
- Trumpable by: superior source, additional assets (commentary, isolated score, English dub), named chapters from retail, defective streams, missing English PGS sub, missing chapters.

### Encodes
- Must include encode settings in MediaInfo. CRF or 2-pass VBR. Retail untouched source. Black bars cropped.
- Codecs: x264, x265, or AV1. Min 720p (unless source is lower). **720p must use x264 only.**
- **1080p:** Lossy codec for multi-channel 3.0+ main audio. FLAC only for 1.0/2.0 (24-bit dithered to 16-bit). Lossy for commentary/isolated score.
- AV1 has separate slots from x265 at each resolution.

### WEB-DLs
- MKV (or MP4 for DV Profile 5). Include all retail subtitles where feasible.
- 1 slot per provider per resolution/HDR format. One additional 2160p slot for lossless audio regardless of provider.

### WEBRips
- WEB-DL always retains slot. WEBRip gets additional slot only with proof of visual improvement via comparisons.

### Slots by Resolution
- **SD:** Only if no HD retail source exists. 1 WEB-DL per provider, 1 DVD Remux slot.
- **720p:** 1 WEB-DL per provider (H.264 only). x264 encodes only.
- **1080p:** 1 WEB-DL per provider per format (H.264 / DV H.265 / HDR H.265). Encodes coexist if distinct. 1 Remux slot.
- **2160p:** 1 WEB-DL per provider per format. Encodes coexist if distinct. 1 SDR Remux + 1 DV/HDR Remux + 1 Hybrid DV/HDR10+ Remux slot.

### General Trumping
- REPACK/PROPER trumps original. DVD Remux trumps DVDRip. Season packs trump individual episodes.
- Dead torrents (0 seeders) trumpable by equivalent or better release.
- Foreign overlays on English-language titles are trumpable. Modified folder/file names are trumpable.
- SDR, HDR, HDR10+, DV each have separate slots. 3D has separate slots. Alternate cuts get separate slots if differences documented.`,
  },
  stats: {
    userCount: 13129,
    activeUsers: 4345,
    torrentCount: 128684,
    seedSize: "2.39 PiB",
    statsUpdatedAt: "2026-03-10",
  },
  language: "English",
  color: "#12BC00",
  logo: undefined,
  draft: false,
}
