import { getSupabaseBrowser } from './auth'

export const supabase = getSupabaseBrowser()

// Removed unused interface Conversacion to satisfy no-unused-vars

export interface CatalogacionCompleta {
  parish_id?: string
  parish_name?: string
  user_id: string
  tipo_objeto: string
  categoria: string
  descripcion_breve: string
  descripcion_detallada: string
  materiales: string[]
  tecnicas: string[]
  estilo_artistico: string
  datacion_aproximada: string
  siglos_estimados: string
  iconografia: string
  estado_conservacion: string
  deterioros_visibles: string[]
  dimensiones_estimadas: string
  valor_artistico: string
  observaciones: string
  confianza_analisis: string
  // campos adicionales
  inventory_number?: string
  location?: string
  image_url?: string
  image_path?: string
  // compatibilidad con campos opcionales
  name?: string
  author?: string
  autor?: string
  localizacion_actual?: string
  published_at?: string
  approved_at?: string
  status?: string
}

export async function guardarConversacion(
  userId: string,
  mensaje: string,
  respuesta: string
) {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('conversaciones')
      .insert([
        {
          user_id: userId,
          mensaje: mensaje,
          respuesta: respuesta,
          fecha: new Date().toISOString()
        }
      ])
      .select()

    if (error) {
      console.error('❌ Error al guardar conversación:', error)
      return null
    }
    
    console.log('✅ Conversación guardada correctamente')
    return data
  } catch (error: unknown) {
    console.error('❌ Error inesperado al guardar:', error)
    return null
  }
}

async function uploadViaApiRoute(file: File): Promise<{ path: string; url: string } | null> {
  try {
    const form = new FormData()
    form.append('file', file)
    // El userId se deriva en servidor vía cookies; no se envía aquí

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: form,
    })

    if (!res.ok) {
      console.error('❌ Fallback /api/upload respondió con error HTTP:', res.status)
      if (res.status === 401) {
        // Propaga un error específico para que la UI pueda redirigir a /auth
        throw new Error('AUTH_401')
      }
      try {
        const errJson = await res.json()
        console.error('📄 Detalle /api/upload:', errJson)
      } catch {}
      return null
    }

    const json = await res.json()
    if (!json?.url || !json?.path) {
      console.error('❌ Fallback /api/upload no devolvió url/path válidos:', json)
      return null
    }

    console.log('✅ Subida vía /api/upload correcta:', json.url)
    return { path: json.path, url: json.url }
  } catch (e) {
    if (e instanceof Error && e.message === 'AUTH_401') {
      // Re-lanza para que Promise.allSettled lo capture como rechazo
      throw e
    }
    console.error('❌ Error al usar fallback /api/upload:', e)
    return null
  }
}

export async function subirImagen(
  file: File,
  userId: string
): Promise<{ path: string; url: string } | null> {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return null
  }

  try {
    console.log('📤 Subiendo imagen a Supabase Storage...')

    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `items/${userId}/${fileName}`

    const { error } = await supabase.storage
      .from('inventario')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream'
      })

    if (error) {
      console.error('❌ Error al subir imagen:', error?.message || error)
      const errObj = (typeof error === 'object' && error) ? error as { name?: string; status?: number; statusCode?: number; cause?: unknown } : {}
      console.error('🔎 Detalle del error Supabase:', errObj)

      // Fallback: subir vía API route para evitar problemas de CORS/red
      console.warn('🔁 Intentando subida alterna vía /api/upload...')
      const viaApi = await uploadViaApiRoute(file)
      if (viaApi) return viaApi

      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('inventario')
      .getPublicUrl(filePath)

    console.log('✅ Imagen subida correctamente:', publicUrl)

    return {
      path: filePath,
      url: publicUrl
    }
  } catch (error: unknown) {
    console.error('❌ Error inesperado al subir imagen:', error)
    try {
      const json = JSON.stringify(error)
      console.error('🧪 Error serializado:', json)
    } catch {}

    // Fallback también si la excepción fue de red CORS
    console.warn('🔁 Intentando subida alterna vía /api/upload tras excepción...')
    const viaApi = await uploadViaApiRoute(file)
    if (viaApi) return viaApi

    return null
  }
}

export async function guardarCatalogacion(
  userId: string,
  catalogo: CatalogacionCompleta,
  imagenFile: File | null
): Promise<{ id: string } | { error: string } | null> {
  try {
    // Determinar imagen a asociar: reutilizar si ya viene en el catálogo, o subir si se proporciona archivo
    let imageUrl = catalogo.image_url || ''
    let imagePath = catalogo.image_path || ''

    if (imagenFile) {
      const resultadoImagen = await subirImagen(imagenFile, userId)
      if (!resultadoImagen) {
        return { error: 'No se pudo subir la fotografía. Inténtalo de nuevo.' }
      }
      imageUrl = resultadoImagen.url
      imagePath = resultadoImagen.path
    }

    if (!imageUrl || !imagePath) {
      return { error: 'No se puede aprobar sin fotografía adjunta.' }
    }

    const jsonRespuesta = {
      ...catalogo,
      image_url: imageUrl,
      image_path: imagePath,
      published_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      status: 'approved'
    }

    const { data, error } = await supabase
      .from('conversaciones')
      .insert([
        {
          user_id: userId,
          fecha: new Date().toISOString(),
          mensaje: 'Aprobación de catalogación',
          respuesta: JSON.stringify(jsonRespuesta)
        }
      ])
      .select()

    if (error) throw error

    return data && data.length > 0 ? { id: data[0].id } : null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Error en guardarCatalogacion:', msg)
    return { error: msg || 'Error desconocido al guardar catalogación' }
  }
}

export async function obtenerConversaciones(userId: string) {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('❌ Error al obtener conversaciones:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('❌ Error inesperado al obtener conversaciones:', error)
    return []
  }
}

export async function eliminarImagen(filePath: string): Promise<boolean> {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return false
  }

  try {
    const { error } = await supabase.storage
      .from('inventario')
      .remove([filePath])

    if (error) {
      console.error('❌ Error al eliminar imagen:', error)
      return false
    }

    console.log('✅ Imagen eliminada correctamente')
    return true
  } catch (error) {
    console.error('❌ Error inesperado al eliminar imagen:', error)
    return false
  }
}

export function obtenerUrlPublica(filePath: string): string | null {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return null
  }

  const { data } = supabase.storage
    .from('inventario')
    .getPublicUrl(filePath)

  return data.publicUrl
}


export interface CatalogoItem {
  id: string
  user_id: string
  fecha: string
  data: CatalogacionCompleta
}

export async function obtenerCatalogo(userId?: string): Promise<CatalogoItem[]> {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return []
  }

  try {
    // 1) Intentar obtener desde tabla items (si existe el esquema ampliado)
    const fromItems = await obtenerCatalogoDesdeItems(userId)
    // Si items existe pero está vacío, hacer fallback a conversaciones para no dejar catálogo vacío
    if (fromItems && Array.isArray(fromItems) && fromItems.length > 0) {
      return fromItems
    }

    // 2) Fallback a conversaciones
    let query = supabase
      .from('conversaciones')
      .select('*')
      .order('fecha', { ascending: false })

    if (userId) query = query.eq('user_id', userId)

    const { data, error } = await query
    if (error) {
      console.error('❌ Error al obtener catálogo:', error)
      return []
    }

    const items: CatalogoItem[] = []
    for (const row of (data || [])) {
      try {
        const parsed = JSON.parse(row.respuesta)
        const hasImage = parsed && typeof parsed.image_url === 'string' && parsed.image_url.trim() !== ''
        const isApproved = Boolean((parsed && parsed.approved_at) || (parsed && parsed.status === 'approved'))
        const isPublished = Boolean((parsed && parsed.published_at) || (parsed && parsed.status === 'published'))
        const passesRule = (isApproved && hasImage) || (isPublished)
        if (parsed && typeof parsed === 'object' && parsed.tipo_objeto && passesRule) {
          items.push({ id: row.id, user_id: row.user_id, fecha: row.fecha, data: parsed })
        }
      } catch {}
    }
    return items
  } catch (error) {
    console.error('❌ Error inesperado al obtener catálogo:', error)
    return []
  }
}

export async function obtenerCatalogoItem(id: string): Promise<CatalogoItem | null> {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return null
  }
  try {
    // 1) Intentar desde items primero
    const fromItems = await obtenerCatalogoItemDesdeItems(id)
    if (fromItems) return fromItems

    // 2) Fallback a conversaciones
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('id', id)
      .limit(1)
    if (error) {
      console.error('❌ Error al obtener item de catálogo:', error)
      return null
    }
    const row = data?.[0]
    if (!row) return null
    try {
      const parsed = JSON.parse(row.respuesta)
      const hasImage = parsed && typeof parsed.image_url === 'string' && parsed.image_url.trim() !== ''
      const isApproved = Boolean((parsed && parsed.approved_at) || (parsed && parsed.status === 'approved'))
      const isPublished = Boolean((parsed && parsed.published_at) || (parsed && parsed.status === 'published'))
      const passesRule = (isApproved && hasImage) || (isPublished)
      if (parsed && typeof parsed === 'object' && parsed.tipo_objeto && passesRule) {
        return { id: row.id, user_id: row.user_id, fecha: row.fecha, data: parsed }
      }
    } catch {}
    return null
  } catch (error) {
    console.error('❌ Error inesperado al obtener item:', error)
    return null
  }
}

// ==========================
// Lectura desde tabla items
// ==========================

type ItemRow = {
  id: string
  user_id: string
  parish_id?: string
  inventory_number?: string
  status?: string
  image_url?: string
  data?: unknown
  published_at?: string
  approved_at?: string
  created_at: string
}

async function obtenerCatalogoDesdeItems(userId?: string): Promise<CatalogoItem[] | null> {
  try {
    let query = supabase
      .from('items')
      .select('id,user_id,parish_id,inventory_number,status,image_url,data,published_at,approved_at,created_at')
      .order('created_at', { ascending: false })

    if (userId) query = query.eq('user_id', userId)

    const { data, error } = await query as unknown as { data: ItemRow[] | null, error: unknown }
    if (error) {
      // Si la tabla o columnas no existen aún, retornar null para fallback
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('⚠️ No se pudo leer items (usando fallback a conversaciones):', errMsg)
      return null
    }

    const items: CatalogoItem[] = []
    for (const row of (data || [])) {
      const parsed = (row.data ?? {}) as Partial<CatalogacionCompleta>
      const hasImage = typeof row.image_url === 'string' && row.image_url.trim() !== ''
      const isApproved = Boolean(row.approved_at || row.status === 'approved')
      const isPublished = Boolean(row.published_at || row.status === 'published')
      const passesRule = (isApproved && hasImage) || (isPublished)
      if (passesRule && (parsed?.tipo_objeto || parsed?.name)) {
        const merged = {
          ...parsed,
          user_id: row.user_id,
          tipo_objeto: parsed.tipo_objeto ?? parsed.name ?? 'sin_especificar',
          parish_id: parsed.parish_id ?? row.parish_id,
          image_url: parsed.image_url ?? row.image_url,
          inventory_number: parsed.inventory_number ?? row.inventory_number,
          published_at: parsed.published_at ?? row.published_at,
          approved_at: parsed.approved_at ?? row.approved_at,
          status: parsed.status ?? row.status,
        } as CatalogacionCompleta
        items.push({ id: row.id, user_id: row.user_id, fecha: row.created_at, data: merged })
      }
    }
    return items
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('⚠️ Error inesperado leyendo items (fallback a conversaciones):', msg)
    return null
  }
}

async function obtenerCatalogoItemDesdeItems(id: string): Promise<CatalogoItem | null> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('id,user_id,parish_id,inventory_number,status,image_url,data,published_at,approved_at,created_at')
      .eq('id', id)
      .limit(1) as unknown as { data: ItemRow[] | null, error: unknown }
    if (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('⚠️ No se pudo leer item desde items (fallback a conversaciones):', errMsg)
      return null
    }
    const row = data?.[0]
    if (!row) return null
    const parsed = (row.data ?? {}) as Partial<CatalogacionCompleta>
    const hasImage = typeof row.image_url === 'string' && row.image_url.trim() !== ''
    const isApproved = Boolean(row.approved_at || row.status === 'approved')
    const isPublished = Boolean(row.published_at || row.status === 'published')
    const passesRule = (isApproved && hasImage) || (isPublished)
    if (!passesRule) return null
    const merged = {
      ...parsed,
      user_id: row.user_id,
      tipo_objeto: parsed.tipo_objeto ?? parsed.name ?? 'sin_especificar',
      parish_id: parsed.parish_id ?? row.parish_id,
      image_url: parsed.image_url ?? row.image_url,
      inventory_number: parsed.inventory_number ?? row.inventory_number,
      published_at: parsed.published_at ?? row.published_at,
      approved_at: parsed.approved_at ?? row.approved_at,
      status: parsed.status ?? row.status,
    } as CatalogacionCompleta
    return { id: row.id, user_id: row.user_id, fecha: row.created_at, data: merged }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('⚠️ Error inesperado leyendo item desde items (fallback a conversaciones):', msg)
    return null
  }
}

export async function obtenerParroquiaNombre(parishId: string): Promise<string | null> {
  if (!supabase) {
    console.warn('⚠️ Supabase no está configurado')
    return null
  }
  try {
    const { data, error } = await supabase
      .from('parishes')
      .select('name')
      .eq('id', parishId)
      .limit(1)
    if (error) {
      console.error('❌ Error al obtener nombre de parroquia:', error)
      return null
    }
    const row = data?.[0] as { name?: string } | undefined
    return row?.name ?? null
  } catch (error) {
    console.error('❌ Error inesperado al obtener nombre de parroquia:', error)
    return null
  }
}