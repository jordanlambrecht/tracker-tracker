ALTER TABLE "app_settings" ADD COLUMN "username" varchar(100);--> statement-breakpoint
ALTER TABLE "trackers" ADD COLUMN "use_proxy" boolean DEFAULT false NOT NULL;