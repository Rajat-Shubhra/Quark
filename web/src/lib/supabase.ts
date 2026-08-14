import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = __SUPABASE_URL__

export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__)
