import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const dreadvault: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "dreadvault",
  name: "DreadVault",
  abbreviation: "dv",
  url: "https://dreadvault.org",
  description: "DreadVault is focused on horror content, including movies, TV shows and horror cartoons/animated series.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Horror content",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f44336",
  logo: "/tracker-logos/dreadvault_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Leech", requirements: "download slots: 0" },
    { name: "User", requirements: "Ratio ≥ 0.4" },
    { name: "Wanderer", requirements: "Ratio ≥ 0.4, min upload ≥ 1TiB, account age ≥ 1 month" },
    { name: "Survivor", requirements: "Ratio ≥ 0.4, min upload ≥ 5TiB, account age ≥ 2 months" },
    { name: "Night Stalker", requirements: "Ratio ≥ 0.4, min upload ≥ 20TiB, account age ≥ 3 months" },
    { name: "Grave Keeper", requirements: "Ratio ≥ 0.4, min upload ≥ 50TiB, account age ≥ 6 months" },
    { name: "Dreadborn", requirements: "Ratio ≥ 0.4, min upload ≥ 100TiB, account age ≥ 1 year" },
    { name: "Shadow Walker", requirements: "Ratio ≥ 0.4, min seedsize ≥ 5TiB, min avg. seedtime ≥ 1 month, account age ≥ 1 month" },
    { name: "Bloodbound", requirements: "Ratio ≥ 0.4, min seedsize ≥ 10TiB, min avg. seedtime ≥ 2 months, account age ≥ 3 months" },
    { name: "Elder", requirements: "An ancient presence whose experience commands respect" },
    { name: "Harbinger", requirements: "A feared and respected presence among the realm’s greatest" },
    { name: "Ancient One", requirements: "Ratio ≥ 1.5, min upload ≥ 10TiB, account age ≥ 6 months, min avg. seedtime ≥ 1 month, min seedsize ≥ 5 TiB, min uploads 500" },
    { name: "VIP", requirements: "A supporter of DreadVault who has chosen to fuel the darkness. VIP status grants exclusive benefits for the selected duration" },
    { name: "The Eternal", requirements: "A timeless supporter of DreadVault. The Eternal has earned a permanent place within the darkness" },
    { name: "The Dread Ascendant", requirements: "A supreme patron of DreadVault. The Dread Ascendant has risen beyond ordinary supporters and stands among the highest ranks of the darkness" },
    { name: "Lorekeeper", requirements: "???" },
    { name: "Vault Warden ", requirements: "???" },

  ],
  releaseGroups: [],
  bannedGroups: [
    "YTS",
    "YIFY",
    "RARBG",
    "VXT",
    "BONE",
    "NeoNoir",
    "PSA",
    "EVO",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.7,
    seedTimeHours: 120,
    loginIntervalDays: 0,
    fulfillmentPeriodHours: 120,
    hnrBanLimit: 3,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
