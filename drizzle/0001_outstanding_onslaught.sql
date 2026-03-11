ALTER TABLE "app_settings" ADD COLUMN "store_usernames" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "totp_backup_codes" text;