import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: NextRequest) {
  try {
    console.log('[API Login] Iniciando login...')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[API Login] Variables de entorno faltantes')
      return NextResponse.json(
        { error: 'Configuración de Supabase incompleta' },
        { status: 500 }
      )
    }

    const { email, password } = await request.json()
    console.log('[API Login] Datos recibidos - Email:', email)
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Crear cliente Supabase para el servidor con manejo de cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => {
          return cookieStore.get(name)?.value
        },
        set: (name: string, value: string, options) => {
          try {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: false, // Permitir acceso desde JavaScript para sincronización
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          } catch (error) {
            console.error('[API Login] Error setting cookie:', name, error)
          }
        },
        remove: (name: string, options) => {
          try {
            cookieStore.set(name, '', {
              ...options,
              maxAge: 0,
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          } catch (error) {
            console.error('[API Login] Error removing cookie:', name, error)
          }
        },
      },
    })

    console.log('[API Login] Intentando autenticación...')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[API Login] Error de autenticación:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!data.session) {
      console.error('[API Login] No se pudo crear la sesión')
      return NextResponse.json(
        { error: 'No se pudo crear la sesión' },
        { status: 401 }
      )
    }

    console.log('[API Login] Login exitoso - Usuario:', data.user?.email)
    console.log('[API Login] Sesión establecida en cookies del servidor')
    
    return NextResponse.json({
      success: true,
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at
      }
    })
    
  } catch (error) {
    console.error('[API Login] Error inesperado:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}