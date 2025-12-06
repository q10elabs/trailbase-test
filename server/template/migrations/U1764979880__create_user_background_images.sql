-- Migration: Create user_background_images table for background image uploads
-- Each user can have one background image for their counter display

CREATE TABLE IF NOT EXISTS user_background_images (
  id              INTEGER PRIMARY KEY,
  user            BLOB NOT NULL,
  background_image TEXT CHECK(jsonschema('std.FileUpload', background_image)),
  FOREIGN KEY (user) REFERENCES _user(id) ON DELETE CASCADE,
  UNIQUE(user)
) STRICT;

-- Create index on user column for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_background_images_user ON user_background_images(user);
