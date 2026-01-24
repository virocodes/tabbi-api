-- Agent API Database Schema
-- PostgreSQL (Neon)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- API Keys table
-- Stores hashed API keys for authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(64) UNIQUE NOT NULL,      -- SHA-256 hash of the API key
    key_prefix VARCHAR(12) NOT NULL,            -- aa_live_ or aa_test_
    user_id UUID NOT NULL,                      -- External user identifier
    environment VARCHAR(10) NOT NULL CHECK (environment IN ('live', 'test')),
    name VARCHAR(255),                          -- Optional friendly name
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Index for fast key lookup
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Sessions table
-- Tracks session metadata (actual state is in Durable Object)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id),
    status VARCHAR(20) DEFAULT 'starting' CHECK (status IN ('starting', 'running', 'paused', 'terminated', 'error')),
    repo VARCHAR(255),                          -- Git repository URL or owner/repo
    snapshot_id VARCHAR(255),                   -- Modal snapshot ID when paused
    sandbox_id VARCHAR(255),                    -- Current Modal sandbox ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    terminated_at TIMESTAMPTZ
);

-- Indexes for session queries
CREATE INDEX idx_sessions_api_key_id ON sessions(api_key_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- Usage Records table
-- Tracks usage events for billing and analytics
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id),
    session_id UUID REFERENCES sessions(id),
    event_type VARCHAR(50) NOT NULL,            -- e.g., 'session.created', 'message.sent', 'sandbox.minute'
    quantity INTEGER DEFAULT 1,
    metadata JSONB,                             -- Additional event-specific data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage queries
CREATE INDEX idx_usage_records_api_key_id ON usage_records(api_key_id);
CREATE INDEX idx_usage_records_session_id ON usage_records(session_id);
CREATE INDEX idx_usage_records_event_type ON usage_records(event_type);
CREATE INDEX idx_usage_records_created_at ON usage_records(created_at DESC);

-- Function to update last_used_at on api_keys
CREATE OR REPLACE FUNCTION update_api_key_last_used()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE id = NEW.api_key_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_used_at when session is created
CREATE TRIGGER trigger_update_api_key_last_used
    AFTER INSERT ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_api_key_last_used();

-- Function to update session last_activity_at
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions
    SET last_activity_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_activity_at when usage is recorded
CREATE TRIGGER trigger_update_session_last_activity
    AFTER INSERT ON usage_records
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL)
    EXECUTE FUNCTION update_session_last_activity();

-- Helper view for active sessions with usage
CREATE VIEW active_sessions_view AS
SELECT
    s.id,
    s.api_key_id,
    s.status,
    s.repo,
    s.created_at,
    s.last_activity_at,
    COUNT(u.id) as message_count,
    ak.user_id
FROM sessions s
JOIN api_keys ak ON s.api_key_id = ak.id
LEFT JOIN usage_records u ON s.id = u.session_id AND u.event_type = 'message.sent'
WHERE s.status NOT IN ('terminated')
GROUP BY s.id, s.api_key_id, s.status, s.repo, s.created_at, s.last_activity_at, ak.user_id;

-- Helper function to generate API key
-- Note: Actual key generation should happen in application code
-- This is for reference on the expected format
COMMENT ON TABLE api_keys IS 'API key format: aa_<env>_<32 random alphanumeric chars>
Example: aa_live_abc123def456ghi789jkl012mno345pq
The full key is never stored, only the SHA-256 hash.';
