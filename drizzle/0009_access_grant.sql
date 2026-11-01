CREATE TABLE "access_grant" (
	"email" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
