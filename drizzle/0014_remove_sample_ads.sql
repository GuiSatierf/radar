-- The scheduled collection used the sample ad source, so made-up ads reached the people who use
-- the app. They go, along with the records of those runs; ads added in the admin stay.
DELETE FROM "ad" WHERE "source" = 'fake';--> statement-breakpoint
DELETE FROM "collection_run" WHERE "kind" = 'ads' AND "source" = 'fake';
