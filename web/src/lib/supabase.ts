import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = __SUPABASE_URL__
export const supabaseAnonKey = __SUPABASE_ANON_KEY__

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
