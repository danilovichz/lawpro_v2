import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'lawpro-chat',
    },
  },
  // Add proper CORS configuration
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test the connection with more detailed error handling
supabase.from('chat_sessions').select('count', { count: 'exact', head: true })
  .then(() => {
    console.log('Successfully connected to Supabase');
  })
  .catch((error) => {
    console.error('Error connecting to Supabase:', error);
    if (error.message?.includes('Failed to fetch')) {
      console.error('CORS Error: Please ensure your Supabase project allows requests from:', window.location.origin);
      console.error('Add this origin to your Supabase project settings under Project Settings > API > CORS Configuration');
    }
    console.error('Please check:');
    console.error('1. Supabase URL and Anon Key are correct in .env');
    console.error('2. Supabase project is online');
    console.error('3. CORS settings include your local development URL (http://localhost:5173)');
    console.error('4. No network connectivity issues or interfering browser extensions');
  });