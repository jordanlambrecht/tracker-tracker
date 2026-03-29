// src/lib/limits.ts

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const USERNAME_MIN = 3
export const USERNAME_MAX = 100
export const TOTP_TOKEN_MAX = 2048

// ─── Network ──────────────────────────────────────────────────────────────────
export const PORT_MIN = 1
export const PORT_MAX = 65535

// ─── Tracker ──────────────────────────────────────────────────────────────────
export const TRACKER_NAME_MAX = 100
export const TRACKER_URL_MAX = 500
export const TRACKER_TOKEN_MAX = 500
export const TRACKER_TAG_MAX = 100
export const TRACKER_NOTES_MAX = 2000
export const TRACKER_ROLE_NAME_MAX = 255

// ─── Polling & Retention ──────────────────────────────────────────────────────
export const POLL_INTERVAL_MIN = 15
export const POLL_INTERVAL_MAX = 1440
export const CLIENT_POLL_INTERVAL_MIN = 60
export const CLIENT_POLL_INTERVAL_MAX = 86400
export const CLIENT_POLL_INTERVAL_DEFAULT = 300
export const SNAPSHOT_RETENTION_MIN = 7
export const SNAPSHOT_RETENTION_MAX = 3650
export const SNAPSHOT_QUERY_MAX = 3650
export const FLEET_SNAPSHOT_QUERY_MAX = 365

// ─── Session & Lockout ────────────────────────────────────────────────────────
export const SESSION_TIMEOUT_MIN = 1
export const SESSION_TIMEOUT_MAX = 525960
export const LOCKOUT_THRESHOLD_MIN = 1
export const LOCKOUT_THRESHOLD_MAX = 99
export const LOCKOUT_DURATION_MIN = 1
export const LOCKOUT_DURATION_MAX = 1440

// ─── Backup ───────────────────────────────────────────────────────────────────
export const BACKUP_RETENTION_MIN = 1
export const BACKUP_RETENTION_MAX = 365
export const BACKUP_PASSWORD_MAX = 128

// ─── String Lengths ───────────────────────────────────────────────────────────
export const SHORT_NAME_MAX = 100
export const HOST_MAX = 255
export const CREDENTIAL_MAX = 255
export const LONG_STRING_MAX = 500
export const EMOJI_MAX = 10
export const ALERT_KEY_MAX = 255
export const ALERT_TYPE_MAX = 30
export const SORT_ORDER_MAX = 9999

// ─── Download Clients ─────────────────────────────────────────────────────────
export const CROSS_SEED_TAGS_MAX = 50
export const CROSS_SEED_TAG_MAX = 100

// ─── Misc ─────────────────────────────────────────────────────────────────────
export const QUICKLINK_SLUGS_MAX = 100
export const QUICKLINK_SLUG_MAX = 200
export const REORDER_IDS_MAX = 500
export const IMAGE_EXPIRATION_MAX = 31_536_000
export const EVENTS_LIMIT_MAX = 200
export const EVENTS_LIMIT_DEFAULT = 50

// ─── Time ─────────────────────────────────────────────────────────────────────
export const MS_PER_DAY = 24 * 60 * 60 * 1000
export const ADAPTER_FETCH_TIMEOUT_MS = 15_000
