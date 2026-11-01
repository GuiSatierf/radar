CREATE TABLE "hotmart_plan_mapping" (
	"kind" text NOT NULL,
	"hotmart_id" text NOT NULL,
	"plan" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotmart_plan_mapping_kind_hotmart_id_pk" PRIMARY KEY("kind","hotmart_id")
);
--> statement-breakpoint
CREATE TABLE "hotmart_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hottok_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotmart_settings_single_row" CHECK ("hotmart_settings"."id" = 1)
);
