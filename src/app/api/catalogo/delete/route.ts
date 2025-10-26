import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

// Tipo explícito para la fila de 'conversaciones'
interface ConversacionRow {
  id: string
  respuesta: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id: string | undefined = body?.id

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Falta id válido' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()

    // 1) Obtener la fila para conocer image_path y validar existencia
    const { data: rows, error: selError } = await supabase
      .from('conversaciones')
      .select('id, respuesta')
      .eq('id', id)
      .limit(1)

    if (selError) {
      console.error('Error seleccionando conversación:', selError)
      return NextResponse.json({ ok: false, error: 'Error seleccionando' }, { status: 500 })
    }

    const rowsTyped: ConversacionRow[] | null = rows as ConversacionRow[] | null
    const row = rowsTyped?.[0]
    if (!row) {
      return NextResponse.json({ ok: false, error: 'No existe el item' }, { status: 404 })
    }

    let imagePath: string | undefined
    try {
      const parsed = JSON.parse(row.respuesta || '{}')
      if (parsed && typeof parsed === 'object' && parsed.image_path) {
        imagePath = String(parsed.image_path)
      }
    } catch {}

    // 2) Si hay imagen asociada, intentar eliminarla del storage
    if (imagePath) {
      try {
        const { error: rmError } = await supabase.storage
          .from('inventario')
          .remove([imagePath])
        if (rmError) {
          console.warn('No se pudo eliminar la imagen del storage:', rmError)
        }
      } catch (e) {
        console.warn('Excepción al eliminar imagen del storage:', e)
      }
    }

    // 3) Borrar la fila de la tabla
    const { error: delError } = await supabase
      .from('conversaciones')
      .delete()
      .eq('id', id)

    if (delError) {
      console.error('Error eliminando conversación:', delError)
      return NextResponse.json({ ok: false, error: 'Error eliminando' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error en API borrado catálogo:', e)
    return NextResponse.json({ ok: false, error: 'Error inesperado' }, { status: 500 })
  }
}