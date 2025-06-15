-- Create images bucket
SELECT storage.create_bucket(
  'images'::text,
  true::boolean,
  '{}'::jsonb,
  '{}'::jsonb
);

-- Set bucket policies
-- Allow authenticated users to upload images
INSERT INTO storage.policies (name, bucket_id, action, enabled)
VALUES (
  'Authenticated users can upload images'::text,
  'images'::text,
  'INSERT'::text,
  true::boolean
)
ON CONFLICT (name, bucket_id) DO UPDATE SET
  action = EXCLUDED.action,
  enabled = EXCLUDED.enabled;

-- Allow authenticated users to read images
INSERT INTO storage.policies (name, bucket_id, action, enabled)
VALUES (
  'Authenticated users can read images'::text,
  'images'::text,
  'SELECT'::text,
  true::boolean
)
ON CONFLICT (name, bucket_id) DO UPDATE SET
  action = EXCLUDED.action,
  enabled = EXCLUDED.enabled;

-- Allow public read access to images
INSERT INTO storage.policies (name, bucket_id, action, enabled)
VALUES (
  'Public can read images'::text,
  'images'::text,
  'SELECT'::text,
  true::boolean
)
ON CONFLICT (name, bucket_id) DO UPDATE SET
  action = EXCLUDED.action,
  enabled = EXCLUDED.enabled;

-- Set default bucket settings
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 10000000, -- 10MB limit
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'images';

-- Create bucket metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.bucket_metadata (
  bucket_id TEXT PRIMARY KEY REFERENCES storage.buckets (id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  file_size_limit INTEGER,
  allowed_mime_types TEXT[]
);

-- Insert bucket metadata
INSERT INTO storage.bucket_metadata (bucket_id, description, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'User profile images bucket',
  10000000, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (bucket_id) DO UPDATE SET
  description = EXCLUDED.description,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = NOW();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION storage.update_bucket_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bucket_metadata_updated_at
  BEFORE UPDATE ON storage.bucket_metadata
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_bucket_metadata_updated_at();
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 10000000, -- 10MB limit
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'images';
