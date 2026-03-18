-- LFG Bot - Database Schema Migration
-- Version: 001_initial_schema
-- Description: Creates all tables, indexes, and Row Level Security policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Hostels table
CREATE TABLE hostels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  telegram_channel_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'banned');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  status user_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admins table
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hostel_id)
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_category_name_per_hostel UNIQUE (hostel_id, name),
  CONSTRAINT global_categories_no_hostel CHECK (
    (is_global = TRUE AND hostel_id IS NULL) OR
    (is_global = FALSE AND hostel_id IS NOT NULL)
  )
);

-- Resources table
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  max_duration_hours INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource sessions table
CREATE TYPE resource_session_status AS ENUM ('active', 'completed', 'expired');

CREATE TABLE resource_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  auto_checkout_at TIMESTAMPTZ NOT NULL,
  status resource_session_status NOT NULL DEFAULT 'active'
);

-- Groups table
CREATE TYPE group_status AS ENUM ('open', 'full', 'in_progress', 'completed', 'cancelled');

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  max_players INTEGER NOT NULL CHECK (max_players >= 2 AND max_players <= 8),
  current_players INTEGER NOT NULL DEFAULT 1,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  status group_status NOT NULL DEFAULT 'open',
  notified_starting_soon BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group members table
CREATE TYPE member_status AS ENUM ('active', 'left');

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  status member_status NOT NULL DEFAULT 'active',
  UNIQUE(group_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_hostel_status ON users(hostel_id, status);

-- Admins indexes
CREATE INDEX idx_admins_user_id ON admins(user_id);
CREATE INDEX idx_admins_hostel_id ON admins(hostel_id);

-- Categories indexes
CREATE INDEX idx_categories_hostel_id ON categories(hostel_id);
CREATE INDEX idx_categories_is_global ON categories(is_global);

-- Resources indexes
CREATE INDEX idx_resources_hostel_id ON resources(hostel_id);
CREATE INDEX idx_resources_category_id ON resources(category_id);

-- Resource sessions indexes
CREATE INDEX idx_resource_sessions_resource_id ON resource_sessions(resource_id);
CREATE INDEX idx_resource_sessions_user_id ON resource_sessions(user_id);
CREATE INDEX idx_resource_sessions_status ON resource_sessions(status);
CREATE INDEX idx_resource_sessions_auto_checkout ON resource_sessions(auto_checkout_at) WHERE status = 'active';

-- Groups indexes
CREATE INDEX idx_groups_hostel_id ON groups(hostel_id);
CREATE INDEX idx_groups_creator_id ON groups(creator_id);
CREATE INDEX idx_groups_category_id ON groups(category_id);
CREATE INDEX idx_groups_status ON groups(status);
CREATE INDEX idx_groups_expires_at ON groups(expires_at);
CREATE INDEX idx_groups_scheduled_for ON groups(scheduled_for);

-- Group members indexes
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_status ON group_members(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on hostels
CREATE TRIGGER update_hostels_updated_at
  BEFORE UPDATE ON hostels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on resources
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on groups
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
-- These policies are for when we implement anon key usage in the future

-- Hostels: Everyone can read
CREATE POLICY hostels_select_policy ON hostels
  FOR SELECT
  USING (true);

-- Users: Users can read approved users in their hostel
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (status = 'approved');

-- Categories: Everyone can read global categories and their hostel's categories
CREATE POLICY categories_select_policy ON categories
  FOR SELECT
  USING (is_global = true OR hostel_id IS NOT NULL);

-- Resources: Everyone can read resources
CREATE POLICY resources_select_policy ON resources
  FOR SELECT
  USING (true);

-- Resource sessions: Users can read active sessions
CREATE POLICY resource_sessions_select_policy ON resource_sessions
  FOR SELECT
  USING (status = 'active');

-- Groups: Users can read active groups in their hostel
CREATE POLICY groups_select_policy ON groups
  FOR SELECT
  USING (status IN ('open', 'full', 'in_progress'));

-- Group members: Everyone can read active memberships
CREATE POLICY group_members_select_policy ON group_members
  FOR SELECT
  USING (status = 'active');

-- Grant permissions to service_role (bypasses RLS but needs table access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
-- Grant permissions to authenticated users (for future anon key usage)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- Grant read permissions to anon (for future public data)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hostels IS 'Different hostel locations';
COMMENT ON TABLE users IS 'Telegram users with approval status';
COMMENT ON TABLE admins IS 'Admin users per hostel';
COMMENT ON TABLE categories IS 'Game categories (global and hostel-specific)';
COMMENT ON TABLE resources IS 'Gaming areas, consoles, tables (linked to hostels)';
COMMENT ON TABLE resource_sessions IS 'Active check-ins/checkouts';
COMMENT ON TABLE groups IS 'Gaming groups/lobbies';
COMMENT ON TABLE group_members IS 'Users in each group';
