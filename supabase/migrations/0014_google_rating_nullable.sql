-- 0014 — Google rating: remove fabricated defaults (Local Discovery Phase 1, task 2): remove fabricated defaults (Local Discovery Phase 1, task 2)
--
-- PROBLEM: `stays.google_rating` / `google_review_count` were created with
-- NOT NULL DEFAULT 4.8 / 36 (0001_initial.sql:96-97). Any INSERT that omits
-- the columns (e.g. createDraftStay) silently gets a fabricated score.
-- Four rows in dev are exactly these defaults (test/converted slugs).
--
-- STATUS: NOT APPLIED — apply only after explicit approval (data change).
-- Code has already been made null-safe: null = "no Google data" = UI hides
-- the Google score entirely (never substituted with another fake value).
-- VietNomad guest-review averages (internal, source-labelled) are unaffected.

ALTER TABLE stays ALTER COLUMN google_rating DROP DEFAULT;
ALTER TABLE stays ALTER COLUMN google_rating DROP NOT NULL;
ALTER TABLE stays ALTER COLUMN google_review_count DROP DEFAULT;
ALTER TABLE stays ALTER COLUMN google_review_count DROP NOT NULL;

-- Clear rows that are byte-for-byte the old column default (no real origin).
-- In dev these are: hgjgj-conv-001, jhhjkh-conv-001, new-listing-14247a,
-- perfume-river-suites-2ad6e4. Seed rows with explicit distinct values
-- (e.g. 4.8/97, 4.9/51) are preserved — their origin is the demo seed.
UPDATE stays
   SET google_rating = NULL,
       google_review_count = NULL
 WHERE google_rating = 4.8
   AND google_review_count = 36;
