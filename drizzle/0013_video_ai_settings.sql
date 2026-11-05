CREATE TABLE "video_provider_key" (
	"provider" text PRIMARY KEY NOT NULL,
	"key_ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"limit_count" integer NOT NULL,
	"limit_period" text NOT NULL,
	"provider" text,
	"model" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_settings_single_row" CHECK ("video_settings"."id" = 1),
	CONSTRAINT "video_settings_limit_count" CHECK ("video_settings"."limit_count" >= 0)
);
