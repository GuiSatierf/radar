CREATE TABLE "hotmart_access" (
	"email" text NOT NULL,
	"product_id" text NOT NULL,
	"plan" text NOT NULL,
	"ends_at" timestamp with time zone,
	"end_applied" boolean DEFAULT false NOT NULL,
	"last_event_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotmart_access_email_product_id_pk" PRIMARY KEY("email","product_id")
);
--> statement-breakpoint
CREATE TABLE "hotmart_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"detail" text
);
