CREATE TABLE "studio_video" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"product_image_url" text,
	"format" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"video_url" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "studio_video" ADD CONSTRAINT "studio_video_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_video_user_created_idx" ON "studio_video" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "studio_video_status_created_idx" ON "studio_video" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "studio_video_one_active_per_user_idx" ON "studio_video" USING btree ("user_id") WHERE "studio_video"."status" in ('queued', 'generating');