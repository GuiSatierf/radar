ALTER TABLE "ad" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ad" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ad" ADD COLUMN "is_curated" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_run" ADD COLUMN "kind" text DEFAULT 'products' NOT NULL;--> statement-breakpoint
CREATE INDEX "ad_source_idx" ON "ad" USING btree ("source");