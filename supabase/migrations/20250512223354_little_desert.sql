/*
  # Update chat system schema

  1. Tables
    - `chat_sessions`: Stores chat session information
      - `id` (uuid, primary key)
      - `session_key` (text, unique)
      - `title` (text)
      - `created_at` (timestamp)
    - `chat_messages`: Stores individual chat messages
      - `id` (uuid, primary key)
      - `session_id` (uuid, references chat_sessions)
      - `content` (text)
      - `is_user` (boolean)
      - `metadata` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Public access policies for development
*/

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text UNIQUE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  is_user boolean NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow all operations on chat_sessions" ON chat_sessions;
  DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON chat_messages;
END $$;

-- Policies for chat_sessions
CREATE POLICY "Allow all operations on chat_sessions"
  ON chat_sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Policies for chat_messages
CREATE POLICY "Allow all operations on chat_messages"
  ON chat_messages
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);