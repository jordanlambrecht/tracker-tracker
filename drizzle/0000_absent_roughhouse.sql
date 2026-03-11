CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"encryption_salt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracker_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tracker_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"polled_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_bytes" bigint NOT NULL,
	"downloaded_bytes" bigint NOT NULL,
	"ratio" real,
	"buffer_bytes" bigint,
	"seeding_count" integer,
	"leeching_count" integer,
	"seedbonus" real,
	"hit_and_runs" integer,
	"username" varchar(255),
	"group_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "trackers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_url" text NOT NULL,
	"api_path" varchar(255) DEFAULT '/api/user' NOT NULL,
	"platform_type" varchar(50) DEFAULT 'unit3d' NOT NULL,
	"encrypted_api_token" text NOT NULL,
	"poll_interval_minutes" integer DEFAULT 360 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp,
	"last_error" text,
	"color" varchar(20) DEFAULT '#00d4ff',
	"qbt_tag" varchar(100),
	"sort_order" integer,
	"joined_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracker_roles" ADD CONSTRAINT "tracker_roles_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_snapshots" ADD CONSTRAINT "tracker_snapshots_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;