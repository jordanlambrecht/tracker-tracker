// src/lib/db/schema.ts
//
// Tables: appSettings, trackers, trackerSnapshots, trackerRoles
import {
  bigint,
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  encryptionSalt: text("encryption_salt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const trackers = pgTable("trackers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: text("base_url").notNull(),
  apiPath: varchar("api_path", { length: 255 }).default("/api/user").notNull(),
  platformType: varchar("platform_type", { length: 50 }).default("unit3d").notNull(),
  encryptedApiToken: text("encrypted_api_token").notNull(),
  pollIntervalMinutes: integer("poll_interval_minutes").default(360).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  color: varchar("color", { length: 20 }).default("#00d4ff"),
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
