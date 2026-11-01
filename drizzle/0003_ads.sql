CREATE TABLE "ad" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ad_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"library_ad_id" text NOT NULL,
	"advertiser_name" text NOT NULL,
	"ad_text" text DEFAULT '' NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"started_on" date NOT NULL,
	"last_seen_on" date NOT NULL,
	"product_id" text,
	"product_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_library_ad_id_unique" UNIQUE("library_ad_id")
);
--> statement-breakpoint
ALTER TABLE "ad" ADD CONSTRAINT "ad_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_product_id_idx" ON "ad" USING btree ("product_id");