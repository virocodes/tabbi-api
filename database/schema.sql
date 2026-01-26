-- =============================================================================
-- Tabbi API - Current Database Schema
-- =============================================================================
-- This file represents the CURRENT state of the database schema.
-- It is regenerated after each migration and serves as reference/context.
--
-- For new installations: Run this file in Supabase SQL Editor
-- For existing databases: Run only the new migration files in migrations/
-- =============================================================================

-- API Keys table (linked to Supabase Auth users)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    environment VARCHAR(10) NOT NULL CHECK (environment IN ('live', 'test')),
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'starting' CHECK (status IN ('starting', 'running', 'idle', 'paused', 'terminated', 'error')),
    repo VARCHAR(255),
    sandbox_id VARCHAR(255),
    snapshot_id VARCHAR(255),
    opencode_session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    terminated_at TIMESTAMPTZ
);

-- Usage records for billing
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_sessions_api_key_id ON sessions(api_key_id);
CREATE INDEX idx_sessions_api_key_status ON sessions(api_key_id, status);
CREATE INDEX idx_usage_records_api_key_created ON usage_records(api_key_id, created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage their own API keys
CREATE POLICY "Users can view own api_keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api_keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api_keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies: Users can view sessions from their API keys
CREATE POLICY "Users can view own sessions"
    ON sessions FOR SELECT
    USING (api_key_id IN (SELECT id FROM api_keys WHERE user_id = auth.uid()));

-- Policies: Users can view own usage
CREATE POLICY "Users can view own usage"
    ON usage_records FOR SELECT
    USING (api_key_id IN (SELECT id FROM api_keys WHERE user_id = auth.uid()));

-- Function to create API key (callable from dashboard)
CREATE OR REPLACE FUNCTION create_api_key(
    key_hash TEXT,
    key_prefix TEXT,
    env TEXT DEFAULT 'live',
    key_name TEXT DEFAULT 'Default'
)
RETURNS api_keys
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_key api_keys;
BEGIN
    INSERT INTO api_keys (key_hash, key_prefix, user_id, environment, name)
    VALUES (key_hash, key_prefix, auth.uid(), env, key_name)
    RETURNING * INTO new_key;

    RETURN new_key;
END;
$$;

-- Function to revoke API key
CREATE OR REPLACE FUNCTION revoke_api_key(key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE api_keys
    SET revoked_at = NOW()
    WHERE id = key_id AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;
