CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_slug" text NOT NULL,
	"category_label" text NOT NULL,
	"shop_name" text NOT NULL,
	"product_url" text NOT NULL,
	"image_urls" text[] DEFAULT '{}' NOT NULL,
	"price_cents" integer NOT NULL,
	"price_max_cents" integer NOT NULL,
	"seller_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"rating_tenths" integer,
	"rating_count" integer,
	"monthly_sales" integer DEFAULT 0 NOT NULL,
	"stock" integer,
	"affiliate_count" integer NOT NULL,
	"affiliate_count_is_minimum" boolean DEFAULT false NOT NULL,
	"has_free_sample" boolean DEFAULT false NOT NULL,
	"seasonal_tags" text[] DEFAULT '{}' NOT NULL,
	"opportunity_score" integer NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_video" (
	"product_id" text NOT NULL,
	"rank" integer NOT NULL,
	"creator_handle" text NOT NULL,
	"views" integer NOT NULL,
	"caption" text,
	"video_url" text,
	CONSTRAINT "product_video_product_id_rank_pk" PRIMARY KEY("product_id","rank")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "commission_profile" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_video" ADD CONSTRAINT "product_video_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_affiliate_count_idx" ON "product" USING btree ("affiliate_count");--> statement-breakpoint
CREATE INDEX "product_monthly_sales_idx" ON "product" USING btree ("monthly_sales");--> statement-breakpoint
CREATE INDEX "product_category_slug_idx" ON "product" USING btree ("category_slug");