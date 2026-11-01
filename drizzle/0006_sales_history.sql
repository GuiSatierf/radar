CREATE TABLE "product_sales_day" (
	"product_id" text NOT NULL,
	"day" date NOT NULL,
	"monthly_sales" integer NOT NULL,
	CONSTRAINT "product_sales_day_product_id_day_pk" PRIMARY KEY("product_id","day")
);
--> statement-breakpoint
CREATE INDEX "product_sales_day_day_idx" ON "product_sales_day" USING btree ("day");