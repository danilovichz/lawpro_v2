-- Add lawyer_results and selected_lawyer columns to chat_sessions
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS lawyer_results jsonb,
ADD COLUMN IF NOT EXISTS selected_lawyer jsonb; 