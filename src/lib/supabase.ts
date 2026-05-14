import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role key: tiene permisos totales, solo se usa en el backend
export const supabase = createClient(supabaseUrl, supabaseServiceKey)