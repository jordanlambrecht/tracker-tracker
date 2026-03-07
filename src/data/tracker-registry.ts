// src/data/tracker-registry.ts
//
// Functions/Exports: TrackerRegistryEntry, TrackerUserClass, TRACKER_REGISTRY, getTrackerBySlug, getAllTrackers

export interface TrackerUserClass {
  name: string
  requirements?: string
}

export interface TrackerRegistryEntry {
  slug: string
  name: string
  url: string
  description: string
  platform: "unit3d" | "gazelle" | "custom"
  apiPath: string
  specialty: string
  contentCategories: string[]
  userClasses: TrackerUserClass[]
  releaseGroups: string[]
  notableMembers: string[]
  bannedGroups?: string[]
  stats?: {
    userCount?: number
    torrentCount?: number
  }
  color: string // hex color for UI theming per tracker
}

export const TRACKER_REGISTRY: TrackerRegistryEntry[] = [
  {
    slug: "aither",
    name: "Aither",
    url: "https://aither.cc",
    description:
      "General private tracker with a focus on high-quality encodes and a welcoming community. Known for its active forums and generous bonus system.",
    platform: "unit3d",
    apiPath: "/api/user",
    specialty: "General / HD content",
    contentCategories: [
      "Movies",
      "TV Shows",
      "Music",
      "Games",
      "Apps",
      "Sport",
      "Education",
      "Audiobooks",
      "XXX",
    ],
    userClasses: [
      { name: "User", requirements: "Default class" },
      { name: "Leech", requirements: "Ratio below 0.4" },
      { name: "Uploader", requirements: "Upload privileges granted" },
      { name: "Trusted Uploader", requirements: "Consistently high-quality uploads" },
      { name: "VIP", requirements: "Significant contribution to the site" },
      { name: "Moderator", requirements: "Staff appointment" },
      { name: "Administrator", requirements: "Staff appointment" },
    ],
    releaseGroups: [],
    notableMembers: [],
    bannedGroups: [],
    stats: {
      userCount: undefined,
      torrentCount: undefined,
    },
    color: "#00d4ff",
  },
  {
    slug: "onlyencodes",
    name: "OnlyEncodes",
    url: "https://onlyencodes.cc",
    description:
      "Specializes exclusively in high-quality video encodes. Curated library focused on the best possible encode for each title. Strict quality standards.",
    platform: "unit3d",
    apiPath: "/api/user",
    specialty: "High-quality video encodes",
    contentCategories: ["Movies", "TV Shows"],
    userClasses: [
      { name: "User", requirements: "Default class" },
      { name: "Power User", requirements: "Ratio and upload requirements met" },
      { name: "Elite", requirements: "Significant contribution" },
      { name: "VIP", requirements: "Distinguished contributor" },
      { name: "Moderator", requirements: "Staff appointment" },
    ],
    releaseGroups: ["GriMM"],
    notableMembers: ["GriMM"],
    bannedGroups: [],
    stats: {
      userCount: undefined,
      torrentCount: undefined,
    },
    color: "#a855f7",
  },
  {
    slug: "fearnopeer",
    name: "FearNoPeer",
    url: "https://fearnopeer.com",
    description:
      "General private tracker emphasizing community and quality content. Known for a friendly atmosphere and active seeding culture.",
    platform: "unit3d",
    apiPath: "/api/user",
    specialty: "General / Community-focused",
    contentCategories: ["Movies", "TV Shows", "Music", "Games", "Apps", "Education"],
    userClasses: [
      { name: "User", requirements: "Default class" },
      { name: "Power User", requirements: "Meet upload and ratio thresholds" },
      { name: "Elite", requirements: "Advanced contribution level" },
      { name: "VIP", requirements: "Top contributor" },
      { name: "Moderator", requirements: "Staff appointment" },
    ],
    releaseGroups: [],
    notableMembers: [],
    bannedGroups: [],
    stats: {
      userCount: undefined,
      torrentCount: undefined,
    },
    color: "#f59e0b",
  },
  {
    slug: "blutopia",
    name: "Blutopia",
    url: "https://blutopia.cc",
    description:
      "Large UNIT3D-based tracker with a broad content library. Active community with comprehensive bonus and freeleech systems.",
    platform: "unit3d",
    apiPath: "/api/user",
    specialty: "General / Large library",
    contentCategories: ["Movies", "TV Shows", "Documentaries", "Fanres", "Music", "Sport"],
    userClasses: [
      { name: "User", requirements: "Default class" },
      {
        name: "Power User",
        requirements: "Ratio ≥ 1.05, upload ≥ 25 GiB, account age ≥ 4 weeks",
      },
      { name: "Super User", requirements: "Ratio ≥ 1.5, upload ≥ 100 GiB" },
      { name: "Elite User", requirements: "Ratio ≥ 2.0, upload ≥ 250 GiB" },
      { name: "VIP", requirements: "Distinguished contributor" },
      { name: "Moderator", requirements: "Staff appointment" },
    ],
    releaseGroups: [],
    notableMembers: [],
    bannedGroups: [],
    stats: {
      userCount: undefined,
      torrentCount: undefined,
    },
    color: "#3b82f6",
  },
]

export function getTrackerBySlug(slug: string): TrackerRegistryEntry | undefined {
  return TRACKER_REGISTRY.find((t) => t.slug === slug)
}

export function getAllTrackers(): TrackerRegistryEntry[] {
  return TRACKER_REGISTRY
}
