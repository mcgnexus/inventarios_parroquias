import { createBrowserClient } from '@supabase/ssr'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabaseBrowser: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowser() {
  if (!supabaseBrowser) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase no configurado (URL o ANON KEY faltante)')
      console.warn('⚠️ supabaseUrl:', supabaseUrl ? 'presente' : 'faltante')
      console.warn('⚠️ supabaseAnonKey:', supabaseAnonKey ? 'presente' : 'faltante')
      return null
    }
    console.log('[Auth] Creando cliente Supabase con URL:', supabaseUrl)
    supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false, // Deshabilitar auto-refresh para evitar conflictos
        persistSession: true,
        detectSessionInUrl: false // Evitar conflictos con URL params
      },
      cookies: {
        get: (name: string) => {
          if (typeof document !== 'undefined') {
            const value = document.cookie
              .split('; ')
              .find(row => row.startsWith(`${name}=`))
              ?.split('=')[1]
            return value
          }
          return undefined
        },
        set: (name: string, value: string, options) => {
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=${value}`
            
            // Configurar opciones por defecto para compatibilidad
            const defaultOptions = {
              path: '/',
              sameSite: 'lax' as const,
              secure: window.location.protocol === 'https:',
              ...options
            }
            
            if (defaultOptions.maxAge !== undefined) {
              cookieString += `; max-age=${defaultOptions.maxAge}`
            }
            if (defaultOptions.path) {
              cookieString += `; path=${defaultOptions.path}`
            }
            if (defaultOptions.domain) {
              cookieString += `; domain=${defaultOptions.domain}`
            }
            if (defaultOptions.secure) {
              cookieString += '; secure'
            }
            if (defaultOptions.sameSite) {
              cookieString += `; samesite=${defaultOptions.sameSite}`
            }
            
            document.cookie = cookieString
          }
        },
        remove: (name: string, options) => {
          if (typeof document !== 'undefined') {
            const defaultOptions = {
              path: '/',
              ...options
            }
            
            let cookieString = `${name}=; max-age=0`
            if (defaultOptions.path) {
              cookieString += `; path=${defaultOptions.path}`
            }
            if (defaultOptions.domain) {
              cookieString += `; domain=${defaultOptions.domain}`
            }
            document.cookie = cookieString
          }
        },
      },
    })
    console.log('[Auth] Cliente Supabase creado:', !!supabaseBrowser)

    // Si el refresco de token falla (token inválido o ausente), forzar signOut y purgar artefactos locales
    try {
      supabaseBrowser.auth.onAuthStateChange(async (event: AuthChangeEvent) => {
        if (event === 'SIGNED_OUT') {
          console.warn('[Auth] SIGNED_OUT → purgando artefactos locales')
          // Eliminar posibles tokens en localStorage y cookies (prefijo sb-)
          try {
            if (typeof window !== 'undefined') {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('sb-'))
                .forEach((k) => localStorage.removeItem(k))
              // Purgar cookies con prefijo sb-
              const cookies = document.cookie.split('; ')
              cookies.forEach((cookie) => {
                const name = cookie.split('=')[0]
                if (name.startsWith('sb-')) {
                  document.cookie = `${name}=; max-age=0; path=/`
                }
              })
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.warn('[Auth] Falló purga de artefactos locales:', msg)
          }
        }
      })
      // No necesitamos almacenar unsub globalmente en este contexto
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[Auth] No se pudo registrar onAuthStateChange:', msg)
    }
  }
  return supabaseBrowser
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabaseBrowser()
  console.log('[Auth] signInWithEmail - Supabase client:', sb)
  if (!sb) throw new Error('Supabase no configurado')
  console.log('[Auth] signInWithEmail - Intentando login con:', { email })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  console.log('[Auth] signInWithEmail - Resultado:', { data, error })
  if (error) {
    console.error('[Auth] signInWithEmail - Error:', error)
    throw error
  }
  return data.user
}

export async function signOut() {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.auth.signOut()
  // Purga defensiva de artefactos locales para evitar estados inválidos persistentes
  try {
    if (typeof window !== 'undefined') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k))
      const cookies = document.cookie.split('; ')
      cookies.forEach((cookie) => {
        const name = cookie.split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; max-age=0; path=/`
        }
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[Auth] Falló purga de artefactos locales en signOut:', msg)
  }
}

export async function getCurrentUser() {
  const sb = getSupabaseBrowser()
  if (!sb) return null
  const { data } = await sb.auth.getUser()
  return data.user
}

function looksLikeUuid(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
}

export async function signUpWithProfile({
  email,
  password,
  fullName,
  role = 'user',
  parishId,
}: {
  email: string
  password: string
  fullName: string
  role?: string
  parishId?: string
}) {
  const sb = getSupabaseBrowser()
  if (!sb) throw new Error('Supabase no configurado')

  let resolvedParishId: string | null = null
  if (parishId && parishId.trim()) {
    const raw = parishId.trim()
    if (looksLikeUuid(raw)) {
      resolvedParishId = raw
    } else {
      try {
        const { data, error } = await sb
          .from('parishes')
          .select('id')
          .eq('name', raw)
          .limit(1)
        if (!error && data && data[0]?.id) {
          const id = data[0]?.id
          if (typeof id === 'string') {
            resolvedParishId = id
          }
        } else if (error) {
          console.warn('⚠️ No se pudo resolver parish_id por nombre:', error.message)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('⚠️ Error inesperado resolviendo parish_id:', msg);
      }
      }
    }

  // Crear usuario en Auth
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role, parish_id: resolvedParishId || null },
    },
  })
  if (error) throw error
  const user = data.user
  if (!user) throw new Error('No se pudo registrar el usuario')

  // Intentar crear/actualizar perfil en tabla profiles
  try {
    const hasSession = !!data.session
    if (hasSession) {
      const { error: profileError } = await sb
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          email,
          role,
          parish_id: resolvedParishId || null,
        })
      if (profileError) {
        console.warn('⚠️ No se pudo crear perfil en profiles (cliente):', profileError.message)
        // Fallback a API si es error de RLS
        if (profileError.message?.toLowerCase().includes('row-level security')) {
          await fetch('/api/profile/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.id,
              full_name: fullName,
              email,
              role,
              parish_id: resolvedParishId || null,
            }),
          })
        }
      }
    } else {
      // Sin sesión tras signUp (p.ej., email confirmation habilitada): usar API con Service Role
      await fetch('/api/profile/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          full_name: fullName,
          email,
          role,
          parish_id: resolvedParishId || null,
        }),
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('⚠️ Error inesperado al crear perfil:', msg)
  }
  return user
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const sb = getSupabaseBrowser()
  if (!sb) return () => {}
  const { data: { subscription } } = sb.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}