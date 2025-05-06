-- Migration to create calendar_tokens table
-- Up Migration
CREATE TABLE IF NOT EXISTS calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, provider)
);

-- Add RLS policies
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policy for users to read only their own tokens
CREATE POLICY calendar_tokens_select_policy ON calendar_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own tokens
CREATE POLICY calendar_tokens_insert_policy ON calendar_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update only their own tokens
CREATE POLICY calendar_tokens_update_policy ON calendar_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete only their own tokens
CREATE POLICY calendar_tokens_delete_policy ON calendar_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Down Migration (for rollback)
-- DROP TABLE IF EXISTS calendar_tokens; 