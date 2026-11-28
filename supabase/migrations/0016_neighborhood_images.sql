--0016: Area cards on Destination Pages need an optional image.
-- Additive only: nullable column, no behavior change for existing rows.
ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN neighborhoods.image_url IS
  'Optional area photo shown on Destination Page area cards (relative /images/... path or absolute URL).';
