-- Clean up legacy bcrypt hashes by setting them to NULL
-- Admins will need to re-set these PINs using the new SHA-256 format
UPDATE profiles 
SET pin_hash = NULL, pin_attempts = 0, pin_locked_until = NULL
WHERE pin_hash LIKE '$2b$%';

-- Add check constraint to prevent bcrypt hashes in the future
ALTER TABLE profiles 
ADD CONSTRAINT pin_hash_format_check 
CHECK (pin_hash IS NULL OR (pin_hash ~ '^[a-f0-9]{64}$'));