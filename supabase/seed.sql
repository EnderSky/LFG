-- LFG Bot - Seed Data
-- Description: Initial data for testing and development

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert a test hostel
INSERT INTO hostels (name, slug, timezone) VALUES
  ('Test Hostel', 'test-hostel', 'UTC')
ON CONFLICT (slug) DO NOTHING;

-- Get the hostel ID for use in subsequent inserts
DO $$
DECLARE
  test_hostel_id UUID;
BEGIN
  SELECT id INTO test_hostel_id FROM hostels WHERE slug = 'test-hostel';

  -- Insert global categories
  INSERT INTO categories (name, icon, is_global, display_order) VALUES
    ('Mahjong', '🀄', TRUE, 1),
    ('Nintendo Switch', '🎮', TRUE, 2),
    ('PlayStation', '🎮', TRUE, 3),
    ('Xbox', '🎮', TRUE, 4),
    ('Board Games', '🎲', TRUE, 5),
    ('Card Games', '🃏', TRUE, 6),
    ('Pool/Billiards', '🎱', TRUE, 7),
    ('Table Tennis', '🏓', TRUE, 8),
    ('Other', '➕', TRUE, 9)
  ON CONFLICT (hostel_id, name) DO NOTHING;

  -- Insert some test resources for the test hostel
  INSERT INTO resources (hostel_id, name, description, max_duration_hours) VALUES
    (test_hostel_id, 'TV Lounge A', '55-inch TV with Switch, PS5, and Xbox', 6),
    (test_hostel_id, 'TV Lounge B', '50-inch TV with Switch and PS4', 6),
    (test_hostel_id, 'Mahjong Table 1', 'Main mahjong table in common area', 6),
    (test_hostel_id, 'Mahjong Table 2', 'Secondary mahjong table', 6),
    (test_hostel_id, 'Pool Table', 'Standard pool table', 4),
    (test_hostel_id, 'Table Tennis', 'Ping pong table in recreation area', 4)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully for hostel: %', test_hostel_id;
END $$;

-- ============================================================================
-- NOTES FOR MANUAL SETUP
-- ============================================================================

-- After running this seed:
-- 1. Create a test user by messaging the bot with /start
-- 2. Make that user an admin by running:
--
--    INSERT INTO admins (user_id, hostel_id, is_super_admin)
--    SELECT u.id, u.hostel_id, true
--    FROM users u
--    WHERE u.telegram_id = YOUR_TELEGRAM_ID;
--
-- 3. Approve the user:
--
--    UPDATE users
--    SET status = 'approved'
--    WHERE telegram_id = YOUR_TELEGRAM_ID;
