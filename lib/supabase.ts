import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL trong file .env.local"
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_ANON_KEY trong file .env.local"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);