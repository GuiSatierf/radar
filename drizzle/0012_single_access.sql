-- No more plans: every old paid plan becomes the single "full" access. Rows without access
-- ("none") stay as they are, so an ended purchase still ends.
UPDATE "user" SET "plan" = 'full' WHERE "plan" IN ('radar', 'completo', 'pro');--> statement-breakpoint
UPDATE "hotmart_access" SET "plan" = 'full' WHERE "plan" IN ('radar', 'completo', 'pro');--> statement-breakpoint
UPDATE "access_grant" SET "plan" = 'full' WHERE "plan" IN ('radar', 'completo', 'pro');--> statement-breakpoint
UPDATE "hotmart_plan_mapping" SET "plan" = 'full' WHERE "plan" IN ('radar', 'completo', 'pro');
