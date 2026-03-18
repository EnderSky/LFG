-- LFG Bot - Add warned_expiring column to resource_sessions
-- Version: 002_add_warned_expiring
-- Description: Adds a boolean column to track if users have been warned about expiring sessions

ALTER TABLE resource_sessions
ADD COLUMN warned_expiring BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for efficient querying of sessions needing warnings
CREATE INDEX idx_resource_sessions_warned_expiring 
ON resource_sessions(auto_checkout_at, warned_expiring) 
WHERE status = 'active' AND warned_expiring = FALSE;
