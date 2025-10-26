import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl) {
  console.warn('⚠️ NEXT_PUBLIC_SUPABASE_URL no está configurada')
}
if (!serviceRoleKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY no está configurada')
}

export function getSupabaseServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase Service Client no configurado (URL o SERVICE ROLE KEY faltante)')
  }
  // El cliente de servicio está destinado a uso en servidor (API routes)
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}