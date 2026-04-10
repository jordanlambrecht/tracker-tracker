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
export const AVISTAZ_TOKEN_MAX = 5000
export const TRACKER_TAG_MAX = 100
export const TRACKER_NOTES_MAX = 2000
export const TRACKER_ROLE_NAME_MAX = 255

// ─── Polling & Retention ──────────────────────────────────────────────────────
export const POLL_INTERVAL_MIN = 15
export const POLL_INTERVAL_MAX = 1440
export const POLL_INTERVAL_DEFAULT = 60
export const POLL_MANUAL_COOLDOWN_MS = 10_000
export const CLIENT_POLL_INTERVAL_MIN = 60
export const CLIENT_POLL_INTERVAL_MAX = 86400
export const CLIENT_POLL_INTERVAL_DEFAULT = 300
export const SNAPSHOT_RETENTION_MIN = 7
export const SNAPSHOT_RETENTION_MAX = 3650
export const SNAPSHOT_RETENTION_DEFAULT = 90
export const SNAPSHOT_QUERY_MAX = 3650
export const FLEET_SNAPSHOT_QUERY_MAX = 365

// ─── Session & Lockout ────────────────────────────────────────────────────────
export const SESSION_TIMEOUT_MIN = 1
export const SESSION_TIMEOUT_MAX = 525960
export const LOCKOUT_THRESHOLD_MIN = 1
export const LOCKOUT_THRESHOLD_MAX = 99
export const LOCKOUT_THRESHOLD_DEFAULT = 5
export const LOCKOUT_DURATION_MIN = 1
export const LOCKOUT_DURATION_MAX = 1440
export const LOCKOUT_DURATION_DEFAULT = 15

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
export const COLOR_STRING_MAX = 20
export const BATCH_MEMBERS_MAX = 500

// ─── Download Clients ─────────────────────────────────────────────────────────
export const CROSS_SEED_TAGS_MAX = 50
export const CROSS_SEED_TAG_MAX = 100

// ─── File Sizes ───────────────────────────────────────────────────────────────
export const UPLOAD_IMAGE_MAX_BYTES = 32 * 1024 * 1024
export const BACKUP_RESTORE_MAX_BYTES = 50 * 1024 * 1024
export const AVATAR_FETCH_MAX_BYTES = 5 * 1024 * 1024
export const MOUSEHOLE_BODY_MAX_BYTES = 256

// ─── Image Hosting ────────────────────────────────────────────────────────────
export const IMAGE_EXPIRATION_MIN = 60
export const IMAGE_EXPIRATION_MAX = 15_552_000

// ─── Notifications ────────────────────────────────────────────────────────────
export const NOTIFICATION_COOLDOWN_MAX_MS = 300_000
export const VIP_EXPIRING_DAYS_DEFAULT = 7
export const UNSATISFIED_LIMIT_PCT_DEFAULT = 80
export const RATIO_DROP_DELTA_DEFAULT = 0.1
export const BUFFER_MILESTONE_DEFAULT_BYTES = 10_737_418_240

// ─── Misc ─────────────────────────────────────────────────────────────────────
export const QUICKLINK_SLUGS_MAX = 100
export const QUICKLINK_SLUG_MAX = 200
export const REORDER_IDS_MAX = 500
export const EVENTS_LIMIT_DEFAULT = 50
export const EVENTS_LIMIT_CAP = 1000

// ─── Time ─────────────────────────────────────────────────────────────────────
export const MS_PER_DAY = 24 * 60 * 60 * 1000
export const ADAPTER_FETCH_TIMEOUT_MS = 15_000
