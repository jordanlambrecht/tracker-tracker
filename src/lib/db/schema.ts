// src/lib/db/schema.ts
//
// Tables: appSettings, trackers, trackerSnapshots, trackerRoles, downloadClients, tagGroups, tagGroupMembers, clientSnapshots, backupHistory, draftQuicklinks (column on appSettings)
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  encryptionSalt: text("encryption_salt").notNull(),
  username: varchar("username", { length: 100 }),
  storeUsernames: boolean("store_usernames").default(true).notNull(),
  totpSecret: text("totp_secret"),
  totpBackupCodes: text("totp_backup_codes"),
  sessionTimeoutMinutes: integer("session_timeout_minutes"),
  autoWipeThreshold: integer("auto_wipe_threshold"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  snapshotRetentionDays: integer("snapshot_retention_days"),
  trackerPollIntervalMinutes: integer("tracker_poll_interval_minutes").default(60).notNull(),
  proxyEnabled: boolean("proxy_enabled").default(false).notNull(),
  proxyType: varchar("proxy_type", { length: 10 }).default("socks5").notNull(),
  proxyHost: varchar("proxy_host", { length: 255 }),
  proxyPort: integer("proxy_port").default(1080),
  proxyUsername: varchar("proxy_username", { length: 255 }),
  encryptedProxyPassword: text("encrypted_proxy_password"),
  qbitmanageEnabled: boolean("qbitmanage_enabled").default(false).notNull(),
  qbitmanageTags: text("qbitmanage_tags"),
  backupScheduleEnabled: boolean("backup_schedule_enabled").default(false).notNull(),
  backupScheduleFrequency: varchar("backup_schedule_frequency", { length: 10 })
    .default("daily")
    .notNull(),
  backupRetentionCount: integer("backup_retention_count").default(14).notNull(),
  backupEncryptionEnabled: boolean("backup_encryption_enabled").default(false).notNull(),
  backupStoragePath: varchar("backup_storage_path", { length: 500 }),
  draftQuicklinks: text("draft_quicklinks"),
  dashboardSettings: text("dashboard_settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const trackers = pgTable("trackers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: text("base_url").notNull(),
  apiPath: varchar("api_path", { length: 255 }).default("/api/user").notNull(),
  platformType: varchar("platform_type", { length: 50 }).default("unit3d").notNull(),
  encryptedApiToken: text("encrypted_api_token").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  color: varchar("color", { length: 20 }).default("#00d4ff"),
  qbtTag: varchar("qbt_tag", { length: 100 }),
  remoteUserId: integer("remote_user_id"),
  platformMeta: text("platform_meta"),
  avatarData: text("avatar_data"),
  avatarCachedAt: timestamp("avatar_cached_at"),
  avatarRemoteUrl: text("avatar_remote_url"),
  useProxy: boolean("use_proxy").default(false).notNull(),
  countCrossSeedUnsatisfied: boolean("count_cross_seed_unsatisfied").default(false).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  sortOrder: integer("sort_order"),
  joinedAt: date("joined_at"),
  lastAccessAt: date("last_access_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const trackerSnapshots = pgTable("tracker_snapshots", {
  id: serial("id").primaryKey(),
  trackerId: integer("tracker_id")
    .references(() => trackers.id, { onDelete: "cascade" })
    .notNull(),
  polledAt: timestamp("polled_at").defaultNow().notNull(),
  uploadedBytes: bigint("uploaded_bytes", { mode: "bigint" }).notNull(),
  downloadedBytes: bigint("downloaded_bytes", { mode: "bigint" }).notNull(),
  ratio: real("ratio"),
  bufferBytes: bigint("buffer_bytes", { mode: "bigint" }),
  seedingCount: integer("seeding_count"),
  leechingCount: integer("leeching_count"),
  seedbonus: real("seedbonus"),
  hitAndRuns: integer("hit_and_runs"),
  requiredRatio: real("required_ratio"),
  warned: boolean("warned"),
  freeleechTokens: integer("freeleech_tokens"),
  shareScore: real("share_score"),
  username: varchar("username", { length: 255 }),
  group: varchar("group_name", { length: 255 }),
})

export const trackerRoles = pgTable("tracker_roles", {
  id: serial("id").primaryKey(),
  trackerId: integer("tracker_id")
    .references(() => trackers.id, { onDelete: "cascade" })
    .notNull(),
  roleName: varchar("role_name", { length: 255 }).notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  notes: text("notes"),
})

export const downloadClients = pgTable("download_clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).default("qbittorrent").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").default(8080).notNull(),
  useSsl: boolean("use_ssl").default(false).notNull(),
  encryptedUsername: text("encrypted_username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  pollIntervalSeconds: integer("poll_interval_seconds").default(300).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  crossSeedTags: text("cross_seed_tags").default("[]").notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  errorSince: timestamp("error_since"),
  cachedTorrents: text("cached_torrents"),
  cachedTorrentsAt: timestamp("cached_torrents_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const clientUptimeBuckets = pgTable(
  "client_uptime_buckets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .references(() => downloadClients.id, { onDelete: "cascade" })
      .notNull(),
    bucketTs: timestamp("bucket_ts").notNull(),
    ok: integer("ok").default(0).notNull(),
    fail: integer("fail").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("uq_client_uptime_bucket").on(table.clientId, table.bucketTs),
    index("idx_uptime_bucket_ts").on(table.bucketTs),
  ]
)

export const tagGroups = pgTable("tag_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }),
  chartType: varchar("chart_type", { length: 20 }).default("bar").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  countUnmatched: boolean("count_unmatched").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const tagGroupMembers = pgTable("tag_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id")
    .references(() => tagGroups.id, { onDelete: "cascade" })
    .notNull(),
  tag: varchar("tag", { length: 100 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
  sortOrder: integer("sort_order").default(0).notNull(),
})

export const clientSnapshots = pgTable("client_snapshots", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => downloadClients.id, { onDelete: "cascade" })
    .notNull(),
  polledAt: timestamp("polled_at").defaultNow().notNull(),
  totalSeedingCount: integer("total_seeding_count"),
  totalLeechingCount: integer("total_leeching_count"),
  uploadSpeedBytes: bigint("upload_speed_bytes", { mode: "bigint" }),
  downloadSpeedBytes: bigint("download_speed_bytes", { mode: "bigint" }),
  tagStats: text("tag_stats"),
})

export const backupHistory = pgTable("backup_history", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  encrypted: boolean("encrypted").default(false).notNull(),
  frequency: varchar("frequency", { length: 10 }),
  status: varchar("status", { length: 20 }).default("completed").notNull(),
  storagePath: text("storage_path"),
  notes: text("notes"),
})
