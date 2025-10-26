import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const effectiveKey = serviceRoleKey || anonKey

// Client con privilegios para Storage (Service Role si disponible)
const supabase = supabaseUrl && effectiveKey
  ? createClient(supabaseUrl, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase no configurado en el servidor' }, { status: 500 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file')

    // Client SSR para obtener usuario desde cookies (solo lectura)
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Auth no configurado' }, { status: 500 })
    }

    const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: async (name: string) => {
          const store = await cookies()
          return store.get(name)?.value
        },
      },
    })

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = authData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
    }

    const size = file.size
    const type = file.type

    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Imagen demasiado grande (max 10MB)' }, { status: 413 })
    }
    if (!type || !type.startsWith('image/')) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    const timestamp = Date.now()
    const originalName = file instanceof File ? file.name : `imagen_${timestamp}.jpg`
    const ext = originalName.split('.').pop() || 'jpg'
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${ext}`
    const filePath = `items/${userId}/${fileName}`

    const contentType = type

    const { error } = await supabase.storage
      .from('inventario')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      })

    if (error) {
      console.error('❌ Error Storage (API):', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('inventario')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl, path: filePath }, { status: 200 })
  } catch (err) {
    console.error('❌ Error inesperado en /api/upload:', err)
    return NextResponse.json({ error: 'Error subiendo imagen' }, { status: 500 })
  }
}