// src/lib/db/schema.ts
//
// Tables: appSettings, trackers, trackerSnapshots, trackerRoles, downloadClients, tagGroups, tagGroupMembers, clientSnapshots, backupHistory, dismissedAlerts, draftQuicklinks (column on appSettings), notificationTargets, notificationDeliveryState
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
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
  lockoutEnabled: boolean("lockout_enabled").default(true).notNull(),
  lockoutThreshold: integer("lockout_threshold").default(5).notNull(),
  lockoutDurationMinutes: integer("lockout_duration_minutes").default(15).notNull(),
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
  encryptedBackupPassword: text("encrypted_backup_password"),
  backupStoragePath: varchar("backup_storage_path", { length: 500 }),
  draftQuicklinks: text("draft_quicklinks"),
  dashboardSettings: text("dashboard_settings"),
  encryptedSchedulerKey: text("encrypted_scheduler_key"),
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
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  pausedAt: timestamp("paused_at"),
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

export const trackerSnapshots = pgTable(
  "tracker_snapshots",
  {
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
  },
  (table) => [
    index("idx_snapshots_tracker_polled").on(table.trackerId, table.polledAt),
    index("idx_snapshots_polled_brin").using("brin", table.polledAt),
  ]
)

export const trackerRoles = pgTable(
  "tracker_roles",
  {
    id: serial("id").primaryKey(),
    trackerId: integer("tracker_id")
      .references(() => trackers.id, { onDelete: "cascade" })
      .notNull(),
    roleName: varchar("role_name", { length: 255 }).notNull(),
    achievedAt: timestamp("achieved_at").defaultNow().notNull(),
    notes: text("notes"),
  },
  (table) => [index("idx_tracker_roles_tracker_id").on(table.trackerId)]
)

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
  crossSeedTags: text("cross_seed_tags").array().default([]).notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  errorSince: timestamp("error_since"),
  cachedTorrents: jsonb("cached_torrents"),
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

export const clientSnapshots = pgTable(
  "client_snapshots",
  {
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
  },
  (table) => [index("idx_client_snapshots_client_polled").on(table.clientId, table.polledAt)]
)

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

export const dismissedAlerts = pgTable(
  "dismissed_alerts",
  {
    id: serial("id").primaryKey(),
    alertKey: varchar("alert_key", { length: 255 }).notNull(),
    alertType: varchar("alert_type", { length: 30 }).notNull(),
    dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_dismissed_alert_key").on(table.alertKey)]
)

// ─── Notification targets ────────────────────────────────────────────────────
//
// One row per notification destination (Discord webhook, future Gotify/Telegram/
// Slack/email). Credentials travel as AES-256-GCM ciphertext in encryptedConfig,
// matching the encrypted* column convention used throughout this schema.
//
// encryptedConfig stores a JSON object whose shape is determined by `type`:
//   discord  → { webhookUrl: string }
//   gotify   → { serverUrl: string, appToken: string }
//   telegram → { botToken: string, chatId: string }
//   slack    → { webhookUrl: string }
//   email    → { host: string, port: number, username: string, password: string, from: string, to: string }
//
// scope stores a PostgreSQL integer array of tracker IDs this target applies to.
// null means "all trackers". Using integer[] lets the application read it as
// number[] without a JSON.parse step and keeps backups trivially serializable.
//
// thresholds stores a typed JSONB object for event-specific numeric limits:
//   { ratioDropDelta?: number, bufferMilestoneBytes?: number }
// null means "use application defaults for all thresholds". Adding a new
// threshold type requires no schema migration — only application code changes.

export const notificationTargets = pgTable("notification_targets", {
  id: serial("id").primaryKey(),

  // Identity
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // "discord" | "gotify" | "telegram" | "slack" | "email"
  enabled: boolean("enabled").default(true).notNull(),

  // Credentials — AES-256-GCM, format: base64(iv + authTag + ciphertext)
  // Shape of the decrypted JSON object is determined by `type` — see comment above.
  encryptedConfig: text("encrypted_config").notNull(),

  // Event subscriptions
  notifyRatioDrop: boolean("notify_ratio_drop").default(false).notNull(),
  notifyHitAndRun: boolean("notify_hit_and_run").default(false).notNull(),
  notifyTrackerDown: boolean("notify_tracker_down").default(false).notNull(),
  notifyBufferMilestone: boolean("notify_buffer_milestone").default(false).notNull(),
  notifyWarned: boolean("notify_warned").default(false).notNull(),
  notifyRatioDanger: boolean("notify_ratio_danger").default(false).notNull(),
  notifyZeroSeeding: boolean("notify_zero_seeding").default(false).notNull(),
  notifyRankChange: boolean("notify_rank_change").default(false).notNull(),
  notifyAnniversary: boolean("notify_anniversary").default(false).notNull(),

  // Event thresholds — nullable JSONB; null means use application defaults.
  // Shape: { ratioDropDelta?: number, bufferMilestoneBytes?: number }
  // Extend this object for future threshold types without a schema migration.
  thresholds: jsonb("thresholds"),

  // Privacy
  includeTrackerName: boolean("include_tracker_name").default(true).notNull(),

  // Scope — null = all trackers; integer array = specific tracker IDs.
  // Not a foreign key; referential integrity enforced at application layer.
  // Stale IDs (deleted trackers) are harmlessly ignored at dispatch time.
  scope: integer("scope").array(),

  // Last delivery state — transient runtime data, excluded from backups.
  // Intentionally not a delivery log; overwritten on each attempt.
  lastDeliveryStatus: varchar("last_delivery_status", { length: 20 }), // "delivered" | "failed" | "rate_limited"
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryError: text("last_delivery_error"), // sanitized, never raw stack traces

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Notification delivery state ─────────────────────────────────────────────
//
// Per-target / per-tracker / per-event cooldown tracking.
// Each row answers: "when did target T last fire event E for tracker X?"
//
// This lives in its own table rather than as columns on notificationTargets
// because a single target can watch N trackers, each firing M event types
// independently. Collapsing this into notificationTargets would require one
// timestamp column per event type per tracker, which is unbounded.
//
// Writes use INSERT ... ON CONFLICT DO UPDATE (upsert) keyed on the unique
// constraint (target_id, tracker_id, event_type).
//
// snoozedUntil: application-controlled "do not re-alert until" timestamp.
// Set by the dispatcher after firing; checked before dispatching. Lets you
// implement per-event cooldown windows (e.g. "don't re-alert on ratio drop
// for this tracker for 6 hours") without additional schema columns.

export const notificationDeliveryState = pgTable(
  "notification_delivery_state",
  {
    id: serial("id").primaryKey(),

    targetId: integer("target_id")
      .references(() => notificationTargets.id, { onDelete: "cascade" })
      .notNull(),

    // null = global event not tied to a specific tracker (reserved for future use).
    // All currently planned events are per-tracker, so this will almost always
    // be non-null. Stored as integer rather than FK to avoid cascade complexity
    // when trackers are deleted — stale rows are inert and cheap to prune.
    trackerId: integer("tracker_id"),

    // Discriminator: "ratio_drop" | "hit_and_run" | "tracker_down" | "buffer_milestone"
    // varchar(50) gives room for future event type names without truncation risk.
    eventType: varchar("event_type", { length: 50 }).notNull(),

    lastNotifiedAt: timestamp("last_notified_at").notNull(),

    // Dispatcher sets this to (lastNotifiedAt + cooldownDuration) after firing.
    // Checked before dispatching: if snoozedUntil > now(), skip silently.
    snoozedUntil: timestamp("snoozed_until"),
  },
  (table) => [
    // Primary lookup key for every cooldown check: "has target T already fired
    // event E for tracker X recently?" — must be unique to enable upsert.
    uniqueIndex("uq_delivery_state_target_tracker_event").on(
      table.targetId,
      table.trackerId,
      table.eventType
    ),
    // Batch cooldown fetch: "find all snooze state for tracker X in one query"
    // — dispatch.ts fetches all rows for a trackerId then checks in-memory via Map.
    index("idx_delivery_state_tracker_id").on(table.trackerId),
  ]
)
